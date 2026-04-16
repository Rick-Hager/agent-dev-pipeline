"use client";

const ORDER_STATUSES = [
  "CREATED",
  "PAYMENT_PENDING",
  "PAYMENT_APPROVED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "CANCELLED",
] as const;

interface OrderFiltersProps {
  status: string;
  dateFrom: string;
  dateTo: string;
  onStatusChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function OrderFilters({
  status,
  dateFrom,
  dateTo,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col gap-1">
        <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status-filter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="date-from" className="text-sm font-medium text-gray-700">
          De
        </label>
        <input
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="date-to" className="text-sm font-medium text-gray-700">
          Até
        </label>
        <input
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
