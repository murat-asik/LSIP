import { BaseModule } from '../base-module';
import { ReputationCalculator } from './reputation-calculator';
import { HostReputation, ReputationSummary, ReputationQueryFilter } from '../../../shared/types/reputation.types';
import { databaseManager } from '../../core/database-manager';

export class ReputationEngineModule extends BaseModule {
  public readonly name = 'reputation';
  public readonly displayName = 'Reputation Engine';
  private recalcTimer: NodeJS.Timeout | null = null;

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Reputation Engine Module...');

    // 1. Get all host reputations
    this.registerIpcHandler<ReputationQueryFilter, HostReputation[]>('list', async (filter) => {
      return this.queryReputations(filter);
    });

    // 2. Get summary statistics
    this.registerIpcHandler<void, ReputationSummary>('summary', async () => {
      return this.getSummary();
    });

    // 3. Trigger a full recalculation
    this.registerIpcHandler<void, HostReputation[]>('recalculate', async () => {
      return ReputationCalculator.recalculateAll();
    });

    // 4. Get single host details
    this.registerIpcHandler<{ hostId: string }, HostReputation>('host-detail', async (payload) => {
      const rep = await ReputationCalculator.calculateHostReputation(payload.hostId);

      // Get score history
      const history = await databaseManager.queryAll<any>(
        'reputation',
        'SELECT score, timestamp, delta FROM score_history WHERE host_id = ? ORDER BY timestamp DESC LIMIT 20',
        [payload.hostId]
      );
      rep.scoreHistory = history.map((h: any) => ({
        score: h.score,
        timestamp: h.timestamp,
        delta: h.delta,
      }));

      return rep;
    });

    // Perform initial calculation after a short delay
    this.registerTimeout(15000, () => {
      ReputationCalculator.recalculateAll().catch((err) => {
        this.logger.error('Initial reputation calculation failed', { error: err.message });
      });
    });

    // Recalculate every 5 minutes
    this.recalcTimer = this.registerInterval(300000, () => {
      ReputationCalculator.recalculateAll().catch((err) => {
        this.logger.error('Periodic reputation recalculation failed', { error: err.message });
      });
    });

    this.logger.info('Reputation Engine Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Reputation Engine Module...');
    if (this.recalcTimer) {
      clearInterval(this.recalcTimer);
      this.recalcTimer = null;
    }
    this.unregisterIpcHandlers();
  }

  private async queryReputations(filter: ReputationQueryFilter): Promise<HostReputation[]> {
    let sql = 'SELECT * FROM host_reputation WHERE 1=1';
    const params: any[] = [];

    if (filter.minScore !== undefined) {
      sql += ' AND risk_score >= ?';
      params.push(filter.minScore);
    }

    if (filter.maxScore !== undefined) {
      sql += ' AND risk_score <= ?';
      params.push(filter.maxScore);
    }

    if (filter.searchQuery) {
      sql += ' AND host_id LIKE ?';
      params.push(`%${filter.searchQuery}%`);
    }

    sql += ' ORDER BY risk_score DESC';

    const limit = filter.limit || 100;
    sql += ' LIMIT ?';
    params.push(limit);

    try {
      const rows = await databaseManager.queryAll<any>('reputation', sql, params);
      return rows.map((r: any) => ({
        hostId: r.host_id,
        ipAddress: r.host_id,
        riskScore: r.risk_score,
        confidence: r.confidence,
        lastCalculated: r.last_calculated,
        factors: r.factors ? JSON.parse(r.factors) : [],
        recommendations: r.recommendations ? JSON.parse(r.recommendations) : [],
        trend: 'stable' as const,
        scoreHistory: [],
      }));
    } catch (err: any) {
      this.logger.error('Failed to query reputations', { error: err.message });
      return [];
    }
  }

  private async getSummary(): Promise<ReputationSummary> {
    try {
      const hosts = await databaseManager.queryAll<any>('reputation', 'SELECT * FROM host_reputation ORDER BY risk_score DESC');

      const totalHosts = hosts.length;
      const highRiskCount = hosts.filter((h: any) => h.risk_score >= 70).length;
      const mediumRiskCount = hosts.filter((h: any) => h.risk_score >= 30 && h.risk_score < 70).length;
      const lowRiskCount = hosts.filter((h: any) => h.risk_score < 30).length;
      const averageScore = totalHosts > 0 ? hosts.reduce((s: number, h: any) => s + h.risk_score, 0) / totalHosts : 0;

      const topThreats = hosts.slice(0, 5).map((r: any) => ({
        hostId: r.host_id,
        ipAddress: r.host_id,
        riskScore: r.risk_score,
        confidence: r.confidence,
        lastCalculated: r.last_calculated,
        factors: r.factors ? JSON.parse(r.factors) : [],
        recommendations: r.recommendations ? JSON.parse(r.recommendations) : [],
        trend: 'stable' as const,
        scoreHistory: [],
      }));

      return {
        totalHosts,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        averageScore: Math.round(averageScore * 10) / 10,
        lastScanTime: Date.now(),
        topThreats,
      };
    } catch (err: any) {
      this.logger.error('Failed to get reputation summary', { error: err.message });
      return {
        totalHosts: 0, highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0,
        averageScore: 0, lastScanTime: Date.now(), topThreats: [],
      };
    }
  }
}
export default ReputationEngineModule;
