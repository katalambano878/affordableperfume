'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    const value = String(cell ?? '');
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const csvContent = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function InventoryManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          sku,
          price,
          quantity,
          categories(name)
        `)
        .order('name');

      if (error) throw error;

      if (data) {
        const mapped = data.map((p: any) => {
          const stock = p.quantity || 0;
          let status = 'good';
          if (stock === 0) status = 'out';
          else if (stock < 10) status = 'low';

          const categoryData = p.categories as { name: string } | { name: string }[] | null;
          const categoryName = Array.isArray(categoryData)
            ? categoryData[0]?.name
            : categoryData?.name;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku || 'N/A',
            category: categoryName || 'Uncategorized',
            currentStock: stock,
            price: p.price || 0,
            status,
          };
        });
        setProducts(mapped);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      stockFilter === 'all' ||
      (stockFilter === 'low' && product.status === 'low') ||
      (stockFilter === 'out' && product.status === 'out') ||
      (stockFilter === 'good' && product.status === 'good');
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = products.filter((p) => p.status === 'low').length;
  const outOfStockCount = products.filter((p) => p.status === 'out').length;
  const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.price, 0);

  const toggleProductSelection = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const toggleAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleExportCSV = () => {
    const source = selectedProducts.length
      ? products.filter((p) => selectedProducts.includes(p.id))
      : filteredProducts;

    downloadCsv(`inventory-export-${new Date().toISOString().split('T')[0]}.csv`, [
      ['SKU', 'Product Name', 'Category', 'Current Stock', 'Price', 'Status'],
      ...source.map((p) => [
        p.sku,
        p.name,
        p.category,
        String(p.currentStock),
        Number(p.price).toFixed(2),
        p.status,
      ]),
    ]);
  };

  const parseCsv = (text: string) => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    const splitLine = (line: string) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
    const skuIdx = headers.findIndex((h) => h === 'sku');
    const qtyIdx = headers.findIndex(
      (h) => h === 'current stock' || h === 'quantity' || h === 'stock' || h === 'qty'
    );
    if (skuIdx < 0 || qtyIdx < 0) {
      throw new Error('CSV must include SKU and Current Stock (or quantity) columns');
    }

    return lines.slice(1).map((line) => {
      const cells = splitLine(line);
      return {
        sku: cells[skuIdx]?.trim(),
        quantity: Number(cells[qtyIdx]),
      };
    });
  };

  const handleImportFile = async (file: File) => {
    try {
      setImporting(true);
      setImportMessage('');
      const text = await file.text();
      const rows = parseCsv(text).filter((r) => r.sku && Number.isFinite(r.quantity) && r.quantity >= 0);
      if (!rows.length) throw new Error('No valid stock rows found in CSV');

      let updated = 0;
      let skipped = 0;
      for (const row of rows) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('sku', row.sku)
          .maybeSingle();
        if (!existing) {
          skipped++;
          continue;
        }
        const { error } = await supabase
          .from('products')
          .update({ quantity: Math.floor(row.quantity), updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) skipped++;
        else updated++;
      }

      setImportMessage(`Updated ${updated} product${updated === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`);
      await fetchInventory();
    } catch (err: any) {
      setImportMessage(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Track stock levels and update quantities
            </p>
          </div>
          <Link
            href="/admin"
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Total Products</p>
            <p className="text-3xl font-bold text-gray-900">{products.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Low Stock Items</p>
            <p className="text-3xl font-bold text-amber-600">{lowStockCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Out of Stock</p>
            <p className="text-3xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Total Retail Value</p>
            <p className="text-3xl font-bold text-blue-600">
              GH₵{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                {['all', 'low', 'out', 'good'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStockFilter(filter)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap ${
                      stockFilter === filter
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {filter === 'all' && 'All'}
                    {filter === 'low' && 'Low Stock'}
                    {filter === 'out' && `Out (${outOfStockCount})`}
                    {filter === 'good' && 'In Stock'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setImportMessage('');
                  setShowImportModal(true);
                }}
                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap"
              >
                <i className="ri-upload-line"></i>
                <span>Import CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-3 rounded-lg font-semibold transition-colors flex items-center space-x-2 whitespace-nowrap"
              >
                <i className="ri-download-line"></i>
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedProducts.length === filteredProducts.length &&
                        filteredProducts.length > 0
                      }
                      onChange={toggleAllProducts}
                      className="w-5 h-5 text-blue-700 rounded"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">SKU</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Stock</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Retail Value</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-gray-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-5 h-5 text-blue-700 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-gray-700">{product.sku}</td>
                      <td className="px-6 py-4 text-gray-700">{product.category}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{product.currentStock}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        GH₵{(product.currentStock * product.price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {product.status === 'good' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                            In Stock
                          </span>
                        )}
                        {product.status === 'low' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                            Low Stock
                          </span>
                        )}
                        {product.status === 'out' && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                            Out of Stock
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 transition-colors"
                            title="Edit product"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </Link>
                          <Link
                            href={product.slug ? `/product/${product.slug}` : `/admin/products/${product.id}`}
                            target="_blank"
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 transition-colors"
                            title="View on storefront"
                          >
                            <i className="ri-eye-line text-lg"></i>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import stock CSV</h2>
                <p className="text-sm text-gray-600 mt-1">
                  CSV must include columns <strong>SKU</strong> and <strong>Current Stock</strong> (or
                  Quantity). Export first for a template.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Close"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
            />

            {importMessage && (
              <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {importMessage}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-lg border-2 border-gray-300 font-semibold text-gray-700"
              >
                Download template
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white font-semibold disabled:opacity-60"
              >
                {importing ? 'Importing…' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
