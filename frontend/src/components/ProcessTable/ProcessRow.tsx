import React from 'react';
import type { ProcessInfo } from '../../types/api';

interface Props {
  process: ProcessInfo;
}

export default function ProcessRow({ process }: Props) {
  const rowClass = process.cpu > 80 || process.mem > 80
    ? 'row-red'
    : process.cpu > 40 || process.mem > 40
      ? 'row-yellow'
      : '';

  return (
    <tr className={rowClass}>
      <td>{process.pid}</td>
      <td>{process.name}</td>
      <td>{process.user}</td>
      <td>{process.cpu.toFixed(1)}</td>
      <td>{process.mem.toFixed(1)}</td>
      <td>{process.vsz}</td>
      <td>{process.rss}</td>
      <td>{process.state}</td>
      <td>{process.threads}</td>
    </tr>
  );
}
