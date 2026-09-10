"use client";

import { useState } from "react";
import { Filter } from "lucide-react";

export const GlobalFilter = () => {
  const [semester, setSemester] = useState("Todos");

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <Filter size={16} className="text-gray-500" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Semestre:</span>
      <select
        value={semester}
        onChange={(e) => setSemester(e.target.value)}
        className="bg-transparent text-sm font-semibold text-blue-600 dark:text-blue-400 outline-none cursor-pointer dark:bg-gray-800"
      >
        <option value="Todos">Todos (Histórico)</option>
        <option value="2024-II">2024-II</option>
        <option value="2024-I">2024-I</option>
        <option value="2023-II">2023-II</option>
      </select>
    </div>
  );
};
