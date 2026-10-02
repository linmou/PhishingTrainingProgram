#!/usr/bin/env node
/** Test target: checklist BDD feature runners. Purpose: provide an in-memory Supabase boundary for real UI, hook, and checklist service flows. */

type Row = Record<string, any>;
type TableName = 'rooms' | 'session_checklists' | 'checklist_items' | 'coverage_evidence' | 'checklist_updates';
type QueryResult = { data: any; error: { code?: string; message: string } | null };

interface SupabaseMock {
  from: jest.Mock;
  rpc: jest.Mock;
}

interface DatabaseState {
  rooms: Row[];
  session_checklists: Row[];
  checklist_items: Row[];
  coverage_evidence: Row[];
  checklist_updates: Row[];
}

class MemoryQuery implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Array<[string, unknown]> = [];
  private payload: Row | Row[] = {};
  private columns = '*';
  private orderBy: { field: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;

  constructor(
    private readonly state: DatabaseState,
    private readonly table: TableName,
    private readonly nextId: () => string
  ) {}

  select(columns = '*'): this {
    this.columns = columns;
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push([field, value]);
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}): this {
    this.orderBy = { field, ascending: options.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  single(): Promise<QueryResult> {
    return this.execute(true, false);
  }

  maybeSingle(): Promise<QueryResult> {
    return this.execute(true, true);
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute(false, false).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(single: boolean, maybeSingle: boolean): Promise<QueryResult> {
    const rows = this.state[this.table];
    const matches = (row: Row) => this.filters.every(([field, value]) => row[field] === value);
    let resultRows: Row[];

    if (this.operation === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      resultRows = payloads.map(payload => {
        const row = {
          id: payload.id ?? this.nextId(),
          created_at: payload.created_at ?? new Date().toISOString(),
          updated_at: payload.updated_at ?? new Date().toISOString(),
          ...payload
        };
        rows.push(row);
        return row;
      });
    } else if (this.operation === 'update') {
      resultRows = rows.filter(matches).map(row => {
        Object.assign(row, this.payload);
        return row;
      });
    } else if (this.operation === 'delete') {
      resultRows = rows.filter(matches);
      this.state[this.table] = rows.filter(row => !matches(row)) as never;
    } else {
      resultRows = rows.filter(matches).map(row => this.attachRelations(row));
      if (this.orderBy) {
        const { field, ascending } = this.orderBy;
        resultRows.sort((left, right) => {
          const order = String(left[field] ?? '').localeCompare(String(right[field] ?? ''));
          return ascending ? order : -order;
        });
      }
    }

    if (this.maxRows !== null) resultRows = resultRows.slice(0, this.maxRows);
    if (single) {
      if (resultRows.length === 0 && maybeSingle) return { data: null, error: null };
      if (resultRows.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Expected one row' } };
      }
      return { data: resultRows[0], error: null };
    }

    return { data: resultRows, error: null };
  }

  private attachRelations(row: Row): Row {
    if (this.table === 'checklist_items' && this.columns.includes('coverage_evidence')) {
      return {
        ...row,
        coverage_evidence: this.state.coverage_evidence.filter(evidence => evidence.item_id === row.id)
      };
    }
    if (this.table === 'session_checklists' && this.columns.includes('checklist_items')) {
      return {
        ...row,
        checklist_items: this.state.checklist_items
          .filter(item => item.checklist_id === row.id)
          .map(item => ({ status: item.status, priority: item.priority }))
      };
    }
    if (this.table === 'checklist_items' && this.columns.includes('session_checklists')) {
      const checklist = this.state.session_checklists.find(candidate => candidate.id === row.checklist_id);
      return { ...row, session_checklists: checklist ? { progress_policy_version: checklist.progress_policy_version } : null };
    }
    return { ...row };
  }
}

export interface ChecklistBddSeedItem extends Partial<Row> {
  area_text: string;
  item_type: 'detection_area' | 'verification_step' | 'understanding' | 'behavior';
  status: 'pending' | 'partially_covered' | 'covered' | 'needs_review';
}

export class ChecklistBddDatabase {
  readonly state: DatabaseState = {
    rooms: [],
    session_checklists: [],
    checklist_items: [],
    coverage_evidence: [],
    checklist_updates: []
  };

  private nextIdValue = 1;

  constructor(private readonly supabase: SupabaseMock) {
    this.reset();
  }

  reset(): void {
    this.state.rooms = [];
    this.state.session_checklists = [];
    this.state.checklist_items = [];
    this.state.coverage_evidence = [];
    this.state.checklist_updates = [];
    this.nextIdValue = 1;
    this.supabase.from.mockImplementation((table: TableName) =>
      new MemoryQuery(this.state, table, () => this.nextId())
    );
    this.supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database RPC is unavailable in the BDD adapter' }
    });
  }

  seedChecklist(roomId: string, templateName: string, items: ChecklistBddSeedItem[]): void {
    const timestamp = '2026-01-15T14:23:45.000Z';
    const checklistId = this.id(900);
    this.state.rooms = [{ id: roomId, active_response_mode: 'tutoring', ai_assistant_enabled: true }];
    this.state.session_checklists = [{
      id: checklistId,
      room_id: roomId,
      template_name: templateName,
      progress_policy_version: 'legacy_v1',
      session_start: timestamp,
      total_items: items.length,
      completed_items: items.filter(item => item.status === 'covered').length,
      completion_percentage: this.percentage(items),
      created_at: timestamp,
      updated_at: timestamp,
      is_active: true
    }];
    this.state.checklist_items = [];
    this.state.coverage_evidence = [];
    this.state.checklist_updates = [];

    items.forEach((item, index) => {
      const { coverage_evidence, ...fields } = item;
      const row = {
        id: fields.id ?? this.id(index + 1),
        checklist_id: checklistId,
        priority: 'important',
        understanding_level: 'none',
        tutor_notes: '',
        attempts_count: 0,
        original_template_area: true,
        last_addressed: null,
        created_at: timestamp,
        updated_at: timestamp,
        ...fields
      };
      this.state.checklist_items.push(row);
      (coverage_evidence ?? []).forEach((evidence: Row) => this.addEvidence(row.id, evidence));
    });
  }

  addEvidence(itemId: string, evidence: Row): Row {
    const saved = {
      id: evidence.id ?? this.nextId(),
      item_id: itemId,
      timestamp: evidence.timestamp ?? new Date().toISOString(),
      ...evidence
    };
    this.state.coverage_evidence.push(saved);
    return saved;
  }

  itemByText(text: string): Row | undefined {
    return this.state.checklist_items.find(item => item.area_text === text);
  }

  private percentage(items: ChecklistBddSeedItem[]): number {
    return items.length === 0 ? 0 : Math.round(items.filter(item => item.status === 'covered').length / items.length * 100);
  }

  private nextId(): string {
    return this.id(this.nextIdValue++);
  }

  private id(sequence: number): string {
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  }
}
