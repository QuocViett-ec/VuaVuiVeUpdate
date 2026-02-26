export interface ApiResponse<T = unknown> {
  ok?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLog {
  id: string;
  action: string;
  who: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
