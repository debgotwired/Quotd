"use client";

import { useRouter } from "next/navigation";

type ClientOption = {
  id: string;
  name: string;
};

export function ClientFilter({
  clients,
  selectedClientId,
}: {
  clients: ClientOption[];
  selectedClientId: string | null;
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      router.push(`/dashboard?client=${value}`);
    } else {
      router.push("/dashboard");
    }
  };

  if (clients.length === 0) return null;

  return (
    <select
      value={selectedClientId || ""}
      onChange={handleChange}
      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
    >
      <option value="">All Clients</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </select>
  );
}
