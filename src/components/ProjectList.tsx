import React from 'react';
import { BAData } from '../types';

interface ProjectListProps {
  bas: BAData[];
}

export default function ProjectList({ bas }: ProjectListProps) {
  return (
    <div className="p-8 w-full flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Project List</h2>
      <p>This module is under construction.</p>
    </div>
  );
}
