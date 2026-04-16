import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

interface AdminNavProps {
  restaurantName: string;
  restaurantSlug: string;
}

export function AdminNav({ restaurantName, restaurantSlug }: AdminNavProps) {
  return (
    <nav className="flex flex-col w-64 min-h-screen bg-white border-r border-gray-200 p-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">{restaurantName}</h2>
      </div>
      <ul className="flex flex-col gap-2 flex-1">
        <li>
          <Link
            href="/backoffice/dashboard"
            className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Dashboard
          </Link>
        </li>
        <li>
          <Link
            href="/backoffice/menu"
            className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Gerenciar Cardápio
          </Link>
        </li>
        <li>
          <Link
            href="/backoffice/orders"
            className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Ver Pedidos
          </Link>
        </li>
        <li>
          <Link
            href="/backoffice/settings"
            className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Configurações
          </Link>
        </li>
        <li>
          <Link
            href={`/${restaurantSlug}/kds`}
            className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            Abrir KDS
          </Link>
        </li>
      </ul>
      <div className="mt-auto pt-4">
        <LogoutButton />
      </div>
    </nav>
  );
}
