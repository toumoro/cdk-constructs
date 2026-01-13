import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';;
import { Construct } from 'constructs';

interface TmRdsAuroraMysqlDashboardProps {
  clusterIdentifier: string;
  dashboardName?: string;
}

export class TmRdsAuroraMysqlDashboard extends Construct {
  constructor(scope: Construct, id: string, props: TmRdsAuroraMysqlDashboardProps) {
    super(scope, id);

    const logGroupName = `/aws/rds/cluster/${props.clusterIdentifier}/slowquery`;

    // Dashboard creation
    const dashboard = new cloudwatch.Dashboard(this, 'RdsAuroraMysqlDashboard', {
      dashboardName: props.dashboardName || 'MysqlDashboard',
    });

    // 2. Widget : Top 20 slowest queries (Table)
    const slowQueryList = new cloudwatch.LogQueryWidget({
      title: 'Top 20 Slowest Queries',
      logGroupNames: [logGroupName],
      view: cloudwatch.LogQueryVisualizationType.TABLE,
      width: 24,
      height: 8,
      queryString: `
      fields @timestamp
      | filter @message like /Query_time:/
      | parse @message "# Query_time: * Lock_time: * Rows_sent: * Rows_examined: *" 
             as query_time, lock_time, rows_sent, rows_examined
      | sort query_time desc
      | limit 20 
      `,
    });


    // 3. Widget : average response time (Graphic)
    const latencyOverTime = new cloudwatch.LogQueryWidget({
      title: 'Average Latency (seconds) over time',
      logGroupNames: [logGroupName],
      view: cloudwatch.LogQueryVisualizationType.LINE,
      width: 12,
      height: 6,
      queryString: `
      fields @timestamp, @message
      | parse @message "Query_time: * " as duration
      | stats avg(duration) by bin(5m)
      `,
    });

    // 4. Widget : slow queries volume per minute
    const volumeWidget = new cloudwatch.LogQueryWidget({
      title: 'Slow Query Count per minute',
      logGroupNames: [logGroupName],
      view: cloudwatch.LogQueryVisualizationType.BAR,
      width: 12,
      height: 6,
      queryString: `
        stats count(*) by bin(1m)
      `,
    });

    dashboard.addWidgets(latencyOverTime, volumeWidget);
    dashboard.addWidgets(slowQueryList);
  }
}