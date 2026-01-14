import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

interface TmRdsAuroraMysqlDashboardProps extends cw.DashboardProps {
  clusterIdentifier: string;
}

export class TmRdsAuroraMysqlDashboard extends cw.Dashboard {
  constructor(scope: Construct, id: string, props: TmRdsAuroraMysqlDashboardProps) {
    super(scope, id, props);

    const logGroupName = `/aws/rds/cluster/${props.clusterIdentifier}/slowquery`;

    // 1. Widget : Top 20 slowest queries (Table)
    const slowQueryList = new cw.LogQueryWidget({
      title: 'Top 20 Slowest Queries',
      logGroupNames: [logGroupName],
      view: cw.LogQueryVisualizationType.TABLE,
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


    // 2. Widget : average response time (Graphic)
    const latencyOverTime = new cw.LogQueryWidget({
      title: 'Average Latency (seconds) over time',
      logGroupNames: [logGroupName],
      view: cw.LogQueryVisualizationType.LINE,
      width: 12,
      height: 6,
      queryString: `
        fields @timestamp, @message
        | parse @message "Query_time: * " as duration
        | stats avg(duration) by bin(5m)
        `,
    });

    // 3. Widget : slow queries volume per minute
    const volumeWidget = new cw.LogQueryWidget({
      title: 'Slow Query Count per minute',
      logGroupNames: [logGroupName],
      view: cw.LogQueryVisualizationType.BAR,
      width: 12,
      height: 6,
      queryString: `
          stats count(*) by bin(1m)
        `,
    });

    this.addWidgets(latencyOverTime, volumeWidget);
    this.addWidgets(slowQueryList);
  }
}