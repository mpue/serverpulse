import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, SortingState,
} from '@tanstack/react-table';
import type { ProcessInfo } from '../../types/api';

interface Props {
  data: ProcessInfo[];
  onRowClick: (proc: ProcessInfo) => void;
  canKill: boolean;
  onKill: (pid: number, signal?: 'SIGKILL') => void;
}

const col = createColumnHelper<ProcessInfo>();

function getRowClass(proc: ProcessInfo): string {
  if (proc.cpu > 80 || proc.mem > 80) return 'row-red';
  if (proc.cpu > 40 || proc.mem > 40) return 'row-yellow';
  return '';
}

export default function ProcessTable({ data, onRowClick, canKill, onKill }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => [
    col.accessor('pid', { header: 'PID', size: 70 }),
    col.accessor('name', { header: 'Name', size: 150 }),
    col.accessor('user', { header: 'User', size: 100 }),
    col.accessor('cpu', { header: 'CPU %', size: 80, cell: (info) => info.getValue().toFixed(1) }),
    col.accessor('mem', { header: 'MEM %', size: 80, cell: (info) => info.getValue().toFixed(1) }),
    col.accessor('vsz', { header: 'VSZ (KB)', size: 100 }),
    col.accessor('rss', { header: 'RSS (KB)', size: 100 }),
    col.accessor('state', { header: 'Status', size: 60 }),
    col.accessor('threads', { header: 'Threads', size: 70 }),
    ...(canKill ? [
      col.display({
        id: 'actions',
        header: 'Actions',
        size: 120,
        cell: ({ row }) => (
          <div className="flex gap-8">
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onKill(row.original.pid); }}>
              TERM
            </button>
            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onKill(row.original.pid, 'SIGKILL'); }}>
              KILL
            </button>
          </div>
        ),
      }),
    ] : []),
  ], [canKill, onKill]);

  const table = useReactTable({
    data, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table className="data-table">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id} onClick={header.column.getToggleSortingHandler()} style={{ width: header.getSize() }}>
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className={getRowClass(row.original)} onClick={() => onRowClick(row.original)} style={{ cursor: 'pointer' }}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
