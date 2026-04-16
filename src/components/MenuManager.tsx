"use client";

import { useState } from "react";
import type { Category, MenuItem } from "@prisma/client";

export type CategoryWithItems = Category & { menuItems: MenuItem[] };

interface MenuManagerProps {
  slug: string;
  initialCategories: CategoryWithItems[];
}

interface NewCategoryForm {
  name: string;
}

interface NewItemForm {
  name: string;
  priceInReais: string;
  description: string;
}

interface EditCategoryForm {
  name: string;
}

interface EditItemForm {
  name: string;
  priceInReais: string;
  description: string;
  isAvailable: boolean;
}

function formatPrice(priceInCents: number): string {
  return `R$ ${(priceInCents / 100).toFixed(2).replace(".", ",")}`;
}

export function MenuManager({ slug, initialCategories }: MenuManagerProps) {
  const [categories, setCategories] = useState<CategoryWithItems[]>(initialCategories);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New category form state
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState<NewCategoryForm>({ name: "" });

  // Edit category state: categoryId -> form
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState<EditCategoryForm>({ name: "" });

  // New item form state: categoryId -> form (null means no form open)
  const [newItemCategoryId, setNewItemCategoryId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState<NewItemForm>({ name: "", priceInReais: "", description: "" });

  // Edit item state: itemId -> form
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<EditItemForm>({ name: "", priceInReais: "", description: "", isAvailable: true });

  // Category operations
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryForm.name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${slug}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryForm.name.trim() }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao criar categoria");
      }
      const newCategory = (await response.json()) as Category;
      setCategories((prev) => [...prev, { ...newCategory, menuItems: [] }]);
      setNewCategoryForm({ name: "" });
      setShowNewCategoryForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function startEditCategory(category: CategoryWithItems) {
    setEditingCategoryId(category.id);
    setEditCategoryForm({ name: category.name });
  }

  async function handleUpdateCategory(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    if (!editCategoryForm.name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${slug}/categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCategoryForm.name.trim() }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao atualizar categoria");
      }
      const updated = (await response.json()) as Category;
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, name: updated.name } : c))
      );
      setEditingCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${slug}/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao excluir categoria");
      }
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  // Item operations
  function startNewItem(categoryId: string) {
    setNewItemCategoryId(categoryId);
    setNewItemForm({ name: "", priceInReais: "", description: "" });
  }

  async function handleCreateItem(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    if (!newItemForm.name.trim() || !newItemForm.priceInReais.trim()) return;
    const priceInCents = Math.round(parseFloat(newItemForm.priceInReais.replace(",", ".")) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      setError("Preço inválido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${slug}/categories/${categoryId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemForm.name.trim(),
          priceInCents,
          description: newItemForm.description.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao criar item");
      }
      const newItem = (await response.json()) as MenuItem;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, menuItems: [...c.menuItems, newItem] } : c
        )
      );
      setNewItemCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function startEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name,
      priceInReais: (item.priceInCents / 100).toFixed(2).replace(".", ","),
      description: item.description ?? "",
      isAvailable: item.isAvailable,
    });
  }

  async function handleUpdateItem(e: React.FormEvent, categoryId: string, itemId: string) {
    e.preventDefault();
    if (!editItemForm.name.trim() || !editItemForm.priceInReais.trim()) return;
    const priceInCents = Math.round(parseFloat(editItemForm.priceInReais.replace(",", ".")) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      setError("Preço inválido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/restaurants/${slug}/categories/${categoryId}/items/${itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editItemForm.name.trim(),
            priceInCents,
            description: editItemForm.description.trim() || undefined,
            isAvailable: editItemForm.isAvailable,
          }),
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao atualizar item");
      }
      const updated = (await response.json()) as MenuItem;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, menuItems: c.menuItems.map((item) => (item.id === itemId ? updated : item)) }
            : c
        )
      );
      setEditingItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(categoryId: string, itemId: string) {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/restaurants/${slug}/categories/${categoryId}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erro ao excluir item");
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, menuItems: c.menuItems.filter((item) => item.id !== itemId) }
            : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Nova categoria button */}
      <div className="mb-6">
        {showNewCategoryForm ? (
          <form onSubmit={handleCreateCategory} className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryForm.name}
              onChange={(e) => setNewCategoryForm({ name: e.target.value })}
              placeholder="Nome da categoria"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowNewCategoryForm(false)}
              className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowNewCategoryForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            Nova categoria
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {categories.map((category) => (
          <section key={category.id} className="border border-gray-200 rounded-lg p-6 bg-white">
            {/* Category header */}
            <div className="flex items-center justify-between mb-4">
              {editingCategoryId === category.id ? (
                <form
                  onSubmit={(e) => handleUpdateCategory(e, category.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <input
                    type="text"
                    value={editCategoryForm.name}
                    onChange={(e) => setEditCategoryForm({ name: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCategoryId(null)}
                    className="px-3 py-1 rounded text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
              )}
              <div className="flex items-center gap-2 ml-4">
                {editingCategoryId !== category.id && (
                  <button
                    onClick={() => startEditCategory(category)}
                    className="text-gray-500 hover:text-blue-600 text-sm px-2 py-1 rounded hover:bg-gray-100"
                    aria-label="Editar categoria"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  disabled={loading}
                  className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                  aria-label="Excluir categoria"
                >
                  Excluir categoria
                </button>
              </div>
            </div>

            {/* Menu items list */}
            <div className="space-y-3 mb-4">
              {category.menuItems.map((item) => (
                <div key={item.id}>
                  {editingItemId === item.id ? (
                    <form
                      onSubmit={(e) => handleUpdateItem(e, category.id, item.id)}
                      className="border border-blue-200 rounded p-4 bg-blue-50 space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            value={editItemForm.name}
                            onChange={(e) =>
                              setEditItemForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Preço (R$)
                          </label>
                          <input
                            type="text"
                            value={editItemForm.priceInReais}
                            onChange={(e) =>
                              setEditItemForm((prev) => ({ ...prev, priceInReais: e.target.value }))
                            }
                            placeholder="0,00"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descrição (opcional)
                        </label>
                        <input
                          type="text"
                          value={editItemForm.description}
                          onChange={(e) =>
                            setEditItemForm((prev) => ({ ...prev, description: e.target.value }))
                          }
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`available-${item.id}`}
                          checked={editItemForm.isAvailable}
                          onChange={(e) =>
                            setEditItemForm((prev) => ({
                              ...prev,
                              isAvailable: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <label
                          htmlFor={`available-${item.id}`}
                          className="text-sm text-gray-700"
                        >
                          Disponível
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          <span className="text-gray-700 text-sm">{formatPrice(item.priceInCents)}</span>
                          {!item.isAvailable && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                              Indisponível
                            </span>
                          )}
                          {item.isAvailable && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                              Disponível
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => startEditItem(item)}
                          className="text-gray-500 hover:text-blue-600 text-sm px-2 py-1 rounded hover:bg-gray-100"
                          aria-label={`Editar ${item.name}`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteItem(category.id, item.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Excluir ${item.name}`}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Novo item button / form */}
            {newItemCategoryId === category.id ? (
              <form
                onSubmit={(e) => handleCreateItem(e, category.id)}
                className="border border-dashed border-blue-300 rounded p-4 space-y-3 bg-blue-50"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={newItemForm.name}
                      onChange={(e) =>
                        setNewItemForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Nome do item"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço (R$)
                    </label>
                    <input
                      type="text"
                      value={newItemForm.priceInReais}
                      onChange={(e) =>
                        setNewItemForm((prev) => ({ ...prev, priceInReais: e.target.value }))
                      }
                      placeholder="0,00"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={newItemForm.description}
                    onChange={(e) =>
                      setNewItemForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemCategoryId(null)}
                    className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => startNewItem(category.id)}
                className="text-blue-600 border border-dashed border-blue-300 px-4 py-2 rounded text-sm hover:bg-blue-50 w-full"
              >
                Novo item
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
