import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Order {
  id: number;
  order_number: string;
  customer_info: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  carrier: string;
  service_type: string;
  status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  cutoff_time: string;
  created_at: string;
  updated_at: string;
}

interface FilterState {
  status: string;
  priority: string;
  carrier: string;
  dateRange: string;
  search: string;
}

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    priority: '',
    carrier: '',
    dateRange: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'status-warning' },
    { value: 'processing', label: 'Processing', color: 'status-info' },
    { value: 'packed', label: 'Packed', color: 'status-success' },
    { value: 'shipped', label: 'Shipped', color: 'status-success' },
    { value: 'delivered', label: 'Delivered', color: 'status-success' },
    { value: 'cancelled', label: 'Cancelled', color: 'status-danger' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-gray-600' },
    { value: 'normal', label: 'Normal', color: 'text-blue-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
  ];

  const carrierOptions = [
    'FedEx',
    'UPS',
    'USPS',
    'DHL',
    'OnTrac'
  ];

  useEffect(() => {
    fetchOrders();
  }, [currentPage, sortField, sortDirection, filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });

      const response = await axios.get(`/api/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setOrders(response.data.orders || []);
      setTotalPages(Math.ceil((response.data.total || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Mock data for development
      setOrders(generateMockOrders());
      setTotalPages(5);
    } finally {
      setLoading(false);
    }
  };

  const generateMockOrders = (): Order[] => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      order_number: `ORD-${String(i + 1).padStart(6, '0')}`,
      customer_info: {
        name: `Customer ${i + 1}`,
        email: `customer${i + 1}@example.com`,
        phone: `555-${String(i + 1).padStart(4, '0')}`
      },
      items: [
        {
          sku: `SKU-${i + 1}`,
          name: `Product ${i + 1}`,
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.random() * 100 + 10
        }
      ],
      shipping_address: {
        street: `${i + 1} Main St`,
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        country: 'USA'
      },
      carrier: carrierOptions[Math.floor(Math.random() * carrierOptions.length)],
      service_type: 'Ground',
      status: statusOptions[Math.floor(Math.random() * statusOptions.length)].value as any,
      priority: priorityOptions[Math.floor(Math.random() * priorityOptions.length)].value as any,
      cutoff_time: '15:00:00',
      created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }));
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/orders/${orderId}`, 
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus as any, updated_at: new Date().toISOString() } : order
      ));
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  const handlePriorityUpdate = async (orderId: number, newPriority: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/orders/${orderId}`, 
        { priority: newPriority },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, priority: newPriority as any, updated_at: new Date().toISOString() } : order
      ));
    } catch (error) {
      console.error('Error updating order priority:', error);
      alert('Failed to update order priority');
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        selectedOrders.map(orderId =>
          axios.patch(`/api/orders/${orderId}`, 
            { status: newStatus },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          )
        )
      );
      
      setOrders(prev => prev.map(order => 
        selectedOrders.includes(order.id) 
          ? { ...order, status: newStatus as any, updated_at: new Date().toISOString() } 
          : order
      ));
      setSelectedOrders([]);
    } catch (error) {
      console.error('Error bulk updating orders:', error);
      alert('Failed to update selected orders');
    }
  };

  const handleSelectOrder = (orderId: number, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const getStatusColor = (status: string) => {
    return statusOptions.find(option => option.value === status)?.color || 'status-info';
  };

  const getPriorityColor = (priority: string) => {
    return priorityOptions.find(option => option.value === priority)?.color || 'text-gray-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalValue = (items: Order['items']) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600">Manage and track all warehouse orders</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-outline"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
            <button className="btn-primary">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Order
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="form-input"
                placeholder="Order number, customer..."
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="form-input"
              >
                <option value="">All Statuses</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="form-input"
              >
                <option value="">All Priorities</option>
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Carrier</label>
              <select
                value={filters.carrier}
                onChange={(e) => handleFilterChange('carrier', e.target.value)}
                className="form-input"
              >
                <option value="">All Carriers</option>
                {carrierOptions.map(carrier => (
                  <option key={carrier} value={carrier}>{carrier}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="form-input"
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedOrders.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Bulk Actions:</span>
              <select
                onChange={(e) => e.target.value && handleBulkStatusUpdate(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
                defaultValue=""
              >
                <option value="">Update Status</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedOrders([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header w-4">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === orders.length && orders.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="table-header cursor-pointer" onClick={() => handleSort('order_number')}>
                  <div className="flex items-center">
                    Order #
                    {sortField === 'order_number' && (
                      <svg className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="table-header">Customer</th>
                <th className="table-header">Items</th>
                <th className="table-header">Value</th>
                <th className="table-header">Status</th>
                <th className="table-header">Priority</th>
                <th className="table-header">Carrier</th>
                <th className="table-header cursor-pointer" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center">
                    Created
                    {sortField === 'created_at' && (
                      <svg className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="table-cell text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="loading-spinner mr-2"></div>
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-cell text-center py-8 text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="table-cell font-medium text-primary-600">
                      {order.order_number}
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="font-medium text-gray-900">{order.customer_info.name}</div>
                        <div className="text-sm text-gray-500">{order.customer_info.email}</div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="text-sm">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="table-cell font-medium">
                      ${getTotalValue(order.items).toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 font-medium ${getStatusColor(order.status)}`}
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <select
                        value={order.priority}
                        onChange={(e) => handlePriorityUpdate(order.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded border font-medium ${getPriorityColor(order.priority)}`}
                      >
                        {priorityOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell text-sm">
                      {order.carrier}
                    </td>
                    <td className="table-cell text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button className="text-primary-600 hover:text-primary-800 text-sm">
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 text-sm">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, orders.length)}</span> of{' '}
                  <span className="font-medium">{orders.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
