interface StatCardProps {
  title: string;
  value: string;
  description?: string;
}

export function StatCard({ title, value, description }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {description !== undefined && (
        <p data-testid="stat-card-description" className="mt-1 text-sm text-gray-600">
          {description}
        </p>
      )}
    </div>
  );
}
