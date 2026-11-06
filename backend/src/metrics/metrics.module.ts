import { Module } from '@nestjs/common';
import { DbMetricsCollector } from './db-collector';

@Module({
  providers: [DbMetricsCollector],
})
export class MetricsModule {}
