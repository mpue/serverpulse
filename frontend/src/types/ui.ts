export interface NavItem {
  path: string;
  label: string;
  icon?: string;
  roles?: string[];
}

export interface TableSortState {
  column: string;
  direction: 'asc' | 'desc';
}
