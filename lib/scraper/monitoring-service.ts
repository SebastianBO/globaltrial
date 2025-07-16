import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

interface Alert {
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  metadata?: any;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: any;
}

export class MonitoringService extends EventEmitter {
  private supabase: any;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private metricsBuffer: any[] = [];
  private alertThresholds = {
    jobQueueDepth: 10000,
    failureRate: 0.1,
    workerTimeout: 300000, // 5 minutes
    apiRateLimit: 0.9, // 90% of limit
    diskUsage: 0.85 // 85%
  };

  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor job queue
    setInterval(() => this.checkJobQueue(), 60000); // Every minute
    
    // Monitor scraping jobs
    setInterval(() => this.checkScrapingJobs(), 120000); // Every 2 minutes
    
    // Monitor system health
    setInterval(() => this.checkSystemHealth(), 300000); // Every 5 minutes
    
    // Flush metrics buffer
    setInterval(() => this.flushMetrics(), 30000); // Every 30 seconds
    
    // Check for stale locks
    setInterval(() => this.checkStaleLocks(), 180000); // Every 3 minutes
  }

  private async checkJobQueue(): Promise<void> {
    try {
      // Check queue depth
      const { data: queueStats } = await this.supabase
        .from('job_queue')
        .select('status, queue_name, count(*)', { count: 'exact' })
        .group('status, queue_name');

      for (const stat of queueStats || []) {
        this.recordMetric('job_queue_depth', stat.count, {
          queue: stat.queue_name,
          status: stat.status
        });

        // Alert if queue is too deep
        if (stat.status === 'pending' && stat.count > this.alertThresholds.jobQueueDepth) {
          this.sendAlert({
            type: 'warning',
            severity: 'high',
            title: 'Job Queue Backlog',
            message: `Queue ${stat.queue_name} has ${stat.count} pending jobs`,
            metadata: { queue: stat.queue_name, count: stat.count }
          });
        }
      }

      // Check failure rate
      const { data: failureStats } = await this.supabase
        .from('job_queue')
        .select('*')
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 3600000)); // Last hour

      const { data: totalStats } = await this.supabase
        .from('job_queue')
        .select('count(*)', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 3600000));

      if (totalStats && failureStats) {
        const failureRate = failureStats.length / totalStats[0].count;
        this.recordMetric('job_failure_rate', failureRate);

        if (failureRate > this.alertThresholds.failureRate) {
          this.sendAlert({
            type: 'error',
            severity: 'critical',
            title: 'High Job Failure Rate',
            message: `${(failureRate * 100).toFixed(1)}% of jobs failed in the last hour`,
            metadata: { 
              failureRate, 
              failedJobs: failureStats.length,
              totalJobs: totalStats[0].count 
            }
          });
        }
      }

      this.updateHealthCheck('job_queue', 'healthy', {
        queueStats,
        failureRate: failureStats?.length || 0
      });

    } catch (error) {
      console.error('Job queue monitoring failed:', error);
      this.updateHealthCheck('job_queue', 'unhealthy', { error: error.message });
    }
  }

  private async checkScrapingJobs(): Promise<void> {
    try {
      // Check for stale jobs
      const { data: staleJobs } = await this.supabase
        .from('scraping_jobs')
        .select('*')
        .eq('status', 'running')
        .lt('last_heartbeat', new Date(Date.now() - this.alertThresholds.workerTimeout));

      if (staleJobs && staleJobs.length > 0) {
        for (const job of staleJobs) {
          this.sendAlert({
            type: 'error',
            severity: 'high',
            title: 'Stale Scraping Job Detected',
            message: `Job ${job.id} hasn't reported heartbeat in ${Math.round((Date.now() - new Date(job.last_heartbeat).getTime()) / 60000)} minutes`,
            metadata: { 
              jobId: job.id,
              jobType: job.job_type,
              workerId: job.worker_id,
              lastHeartbeat: job.last_heartbeat
            }
          });

          // Mark job as failed
          await this.supabase
            .from('scraping_jobs')
            .update({ 
              status: 'failed',
              error_log: [...(job.error_log || []), {
                timestamp: new Date(),
                error: 'Worker timeout - no heartbeat'
              }]
            })
            .eq('id', job.id);
        }
      }

      // Check scraping progress
      const { data: activeJobs } = await this.supabase
        .from('scraping_jobs')
        .select('*')
        .eq('status', 'running');

      for (const job of activeJobs || []) {
        const runtime = Date.now() - new Date(job.started_at).getTime();
        const itemsPerMinute = job.processed_items / (runtime / 60000);

        this.recordMetric('scraping_speed', itemsPerMinute, {
          jobId: job.id,
          jobType: job.job_type,
          registry: job.registry
        });

        if (job.total_items) {
          const estimatedCompletion = (job.total_items - job.processed_items) / itemsPerMinute;
          
          if (estimatedCompletion > 1440) { // More than 24 hours
            this.sendAlert({
              type: 'warning',
              severity: 'medium',
              title: 'Slow Scraping Progress',
              message: `Job ${job.id} estimated to complete in ${Math.round(estimatedCompletion / 60)} hours`,
              metadata: {
                jobId: job.id,
                itemsPerMinute: Math.round(itemsPerMinute),
                estimatedHours: Math.round(estimatedCompletion / 60)
              }
            });
          }
        }
      }

      this.updateHealthCheck('scraping_jobs', 'healthy', {
        activeJobs: activeJobs?.length || 0,
        staleJobs: staleJobs?.length || 0
      });

    } catch (error) {
      console.error('Scraping job monitoring failed:', error);
      this.updateHealthCheck('scraping_jobs', 'unhealthy', { error: error.message });
    }
  }

  private async checkSystemHealth(): Promise<void> {
    try {
      // Check database size
      const { data: dbSize } = await this.supabase.rpc('get_database_size');
      this.recordMetric('database_size_gb', dbSize / 1024 / 1024 / 1024);

      // Check table sizes
      const { data: tableSizes } = await this.supabase.rpc('get_table_sizes');
      for (const table of tableSizes || []) {
        this.recordMetric('table_size_mb', table.size_mb, {
          table: table.table_name
        });
      }

      // Check API rate limits
      const { data: rateLimits } = await this.supabase
        .from('api_rate_limits')
        .select('*')
        .gte('window_start', new Date(Date.now() - 60000));

      for (const limit of rateLimits || []) {
        const usage = limit.requests_made / limit.max_requests;
        this.recordMetric('api_rate_limit_usage', usage, {
          api: limit.api_name,
          endpoint: limit.endpoint
        });

        if (usage > this.alertThresholds.apiRateLimit) {
          this.sendAlert({
            type: 'warning',
            severity: 'medium',
            title: 'API Rate Limit Warning',
            message: `${limit.api_name} at ${(usage * 100).toFixed(0)}% of rate limit`,
            metadata: {
              api: limit.api_name,
              requestsMade: limit.requests_made,
              maxRequests: limit.max_requests
            }
          });
        }
      }

      // Check duplicate detection stats
      const { data: dupStats } = await this.supabase
        .from('trial_duplicates')
        .select('match_type, count(*)', { count: 'exact' })
        .group('match_type');

      this.recordMetric('duplicate_trials', dupStats?.length || 0, {
        stats: dupStats
      });

      this.updateHealthCheck('system', 'healthy', {
        databaseSize: dbSize,
        duplicateStats: dupStats
      });

    } catch (error) {
      console.error('System health check failed:', error);
      this.updateHealthCheck('system', 'unhealthy', { error: error.message });
    }
  }

  private async checkStaleLocks(): Promise<void> {
    try {
      // Find and release stale locks on job queue
      const { data: staleLocks } = await this.supabase
        .from('job_queue')
        .select('*')
        .eq('status', 'processing')
        .lt('locked_at', new Date(Date.now() - this.alertThresholds.workerTimeout));

      if (staleLocks && staleLocks.length > 0) {
        console.log(`Found ${staleLocks.length} stale locks`);

        for (const job of staleLocks) {
          await this.supabase
            .from('job_queue')
            .update({
              status: 'pending',
              locked_at: null,
              locked_by: null,
              last_error: 'Released due to stale lock'
            })
            .eq('id', job.id);
        }

        this.sendAlert({
          type: 'warning',
          severity: 'medium',
          title: 'Stale Locks Released',
          message: `Released ${staleLocks.length} stale job locks`,
          metadata: { count: staleLocks.length }
        });
      }
    } catch (error) {
      console.error('Stale lock check failed:', error);
    }
  }

  private recordMetric(metricType: string, value: number, tags: any = {}): void {
    this.metricsBuffer.push({
      metric_type: metricType,
      metric_name: metricType,
      metric_value: value,
      tags,
      created_at: new Date()
    });
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer = [];

      const { error } = await this.supabase
        .from('system_metrics')
        .insert(metrics);

      if (error) {
        console.error('Failed to flush metrics:', error);
        // Re-add metrics to buffer
        this.metricsBuffer.unshift(...metrics);
      }
    } catch (error) {
      console.error('Metrics flush failed:', error);
    }
  }

  private updateHealthCheck(service: string, status: HealthCheck['status'], metrics: any): void {
    this.healthChecks.set(service, {
      service,
      status,
      lastCheck: new Date(),
      metrics
    });
  }

  private sendAlert(alert: Alert): void {
    console.log(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
    
    // Emit alert event
    this.emit('alert', alert);

    // Store alert in database
    this.supabase
      .from('system_alerts')
      .insert({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
        created_at: new Date()
      })
      .then(() => {})
      .catch(err => console.error('Failed to store alert:', err));

    // Send to external alerting service (e.g., PagerDuty, Slack)
    this.sendExternalAlert(alert);
  }

  private async sendExternalAlert(alert: Alert): Promise<void> {
    // Implement integration with external alerting services
    // For now, just log
    if (alert.severity === 'critical') {
      console.error('CRITICAL ALERT:', alert);
    }
  }

  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: HealthCheck[];
  }> {
    const services = Array.from(this.healthChecks.values());
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) overall = 'unhealthy';
    else if (degradedCount > 0) overall = 'degraded';

    return { overall, services };
  }

  async getDashboardMetrics(): Promise<any> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    const dayAgo = new Date(now.getTime() - 86400000);

    // Get recent metrics
    const { data: metrics } = await this.supabase
      .from('system_metrics')
      .select('*')
      .gte('created_at', hourAgo)
      .order('created_at', { ascending: false });

    // Get job statistics
    const { data: jobStats } = await this.supabase
      .from('job_queue')
      .select('status, count(*)', { count: 'exact' })
      .group('status');

    // Get scraping progress
    const { data: scrapingProgress } = await this.supabase
      .from('scraping_jobs')
      .select('status, sum(processed_items), sum(failed_items), count(*)', { count: 'exact' })
      .group('status');

    // Get trial statistics
    const { data: trialStats } = await this.supabase
      .from('clinical_trials')
      .select('source, count(*)', { count: 'exact' })
      .group('source');

    return {
      health: await this.getHealthStatus(),
      metrics: this.aggregateMetrics(metrics),
      jobStats,
      scrapingProgress,
      trialStats,
      timestamp: now
    };
  }

  private aggregateMetrics(metrics: any[]): any {
    const aggregated: any = {};

    for (const metric of metrics || []) {
      if (!aggregated[metric.metric_type]) {
        aggregated[metric.metric_type] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: []
        };
      }

      const agg = aggregated[metric.metric_type];
      agg.count++;
      agg.sum += metric.metric_value;
      agg.min = Math.min(agg.min, metric.metric_value);
      agg.max = Math.max(agg.max, metric.metric_value);
      agg.values.push({
        value: metric.metric_value,
        timestamp: metric.created_at,
        tags: metric.tags
      });
    }

    // Calculate averages
    for (const type in aggregated) {
      aggregated[type].average = aggregated[type].sum / aggregated[type].count;
    }

    return aggregated;
  }
}

// Create database functions for monitoring
export async function createMonitoringFunctions(supabaseUrl: string, supabaseKey: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const sql = `
    -- Function to get database size
    CREATE OR REPLACE FUNCTION get_database_size()
    RETURNS BIGINT AS $$
    BEGIN
      RETURN (SELECT pg_database_size(current_database()));
    END;
    $$ LANGUAGE plpgsql;

    -- Function to get table sizes
    CREATE OR REPLACE FUNCTION get_table_sizes()
    RETURNS TABLE(
      table_name TEXT,
      size_mb NUMERIC
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        schemaname || '.' || tablename as table_name,
        pg_total_relation_size(schemaname || '.' || tablename) / 1024 / 1024 as size_mb
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
      LIMIT 20;
    END;
    $$ LANGUAGE plpgsql;

    -- Create alerts table
    CREATE TABLE IF NOT EXISTS system_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(20) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      metadata JSONB,
      acknowledged BOOLEAN DEFAULT FALSE,
      acknowledged_by VARCHAR(100),
      acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX idx_alerts_severity ON system_alerts(severity, created_at DESC);
    CREATE INDEX idx_alerts_unack ON system_alerts(acknowledged, created_at DESC);
  `;

  await supabase.rpc('execute_sql', { query: sql });
}