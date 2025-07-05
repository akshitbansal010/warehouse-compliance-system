import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Base URL - adjust based on your backend configuration
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add authentication token
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle 401 unauthorized errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
  }) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },
};

// Users API
export const usersAPI = {
  getUsers: async (params?: {
    skip?: number;
    limit?: number;
    role?: string;
    is_active?: boolean;
  }) => {
    const response = await apiClient.get('/users', { params });
    return response.data;
  },

  getUser: async (userId: number) => {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  },

  createUser: async (userData: {
    username: string;
    email: string;
    password: string;
    role: string;
    is_active?: boolean;
  }) => {
    const response = await apiClient.post('/users', userData);
    return response.data;
  },

  updateUser: async (userId: number, userData: {
    username?: string;
    email?: string;
    role?: string;
    is_active?: boolean;
    password?: string;
  }) => {
    const response = await apiClient.put(`/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId: number) => {
    const response = await apiClient.delete(`/users/${userId}`);
    return response.data;
  },
};

// Routing Guides API
export const routingGuidesAPI = {
  getRoutingGuides: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }) => {
    const response = await apiClient.get('/routing-guides', { params });
    return response.data;
  },

  getRoutingGuide: async (guideId: number) => {
    const response = await apiClient.get(`/routing-guides/${guideId}`);
    return response.data;
  },

  uploadRoutingGuide: async (formData: FormData) => {
    const response = await apiClient.post('/routing-guides/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateRoutingGuide: async (guideId: number, updateData: {
    title?: string;
    description?: string;
    status?: string;
  }) => {
    const response = await apiClient.put(`/routing-guides/${guideId}`, updateData);
    return response.data;
  },

  deleteRoutingGuide: async (guideId: number) => {
    const response = await apiClient.delete(`/routing-guides/${guideId}`);
    return response.data;
  },

  downloadRoutingGuide: async (guideId: number) => {
    const response = await apiClient.get(`/routing-guides/${guideId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Orders API
export interface OrderFilters {
  page?: number;
  limit?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  status?: string;
  priority?: string;
  carrier?: string;
  dateRange?: string;
  search?: string;
}

export interface OrderCreateData {
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
  carrier?: string;
  service_type?: string;
  priority?: string;
  cutoff_time?: string;
}

export interface OrderUpdateData {
  status?: string;
  priority?: string;
  carrier?: string;
  service_type?: string;
  cutoff_time?: string;
}

export const ordersAPI = {
  getOrders: async (filters?: OrderFilters) => {
    const response = await apiClient.get('/orders', { params: filters });
    return response.data;
  },

  getOrder: async (orderId: number) => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  },

  createOrder: async (orderData: OrderCreateData) => {
    const response = await apiClient.post('/orders', orderData);
    return response.data;
  },

  updateOrder: async (orderId: number, updateData: OrderUpdateData) => {
    const response = await apiClient.patch(`/orders/${orderId}`, updateData);
    return response.data;
  },

  deleteOrder: async (orderId: number) => {
    const response = await apiClient.delete(`/orders/${orderId}`);
    return response.data;
  },

  bulkUpdateOrders: async (orderIds: number[], updateData: OrderUpdateData) => {
    const response = await apiClient.patch('/orders/bulk-update', {
      order_ids: orderIds,
      ...updateData,
    });
    return response.data;
  },

  getOrderHistory: async (orderId: number) => {
    const response = await apiClient.get(`/orders/${orderId}/history`);
    return response.data;
  },
};

// Packout Tasks API
export const packoutTasksAPI = {
  getTasks: async (params?: {
    skip?: number;
    limit?: number;
    status?: string;
    worker_id?: number;
    order_id?: number;
  }) => {
    const response = await apiClient.get('/packout-tasks', { params });
    return response.data;
  },

  getTask: async (taskId: number) => {
    const response = await apiClient.get(`/packout-tasks/${taskId}`);
    return response.data;
  },

  createTask: async (taskData: {
    order_id: number;
    worker_id: number;
    routing_guide_id: number;
    instructions?: any;
  }) => {
    const response = await apiClient.post('/packout-tasks', taskData);
    return response.data;
  },

  updateTask: async (taskId: number, updateData: {
    status?: string;
    instructions?: any;
    steps_completed?: any;
    start_time?: string;
    end_time?: string;
  }) => {
    const response = await apiClient.patch(`/packout-tasks/${taskId}`, updateData);
    return response.data;
  },

  deleteTask: async (taskId: number) => {
    const response = await apiClient.delete(`/packout-tasks/${taskId}`);
    return response.data;
  },
};

// Compliance Photos API
export const compliancePhotosAPI = {
  getPhotos: async (params?: {
    skip?: number;
    limit?: number;
    task_id?: number;
    worker_id?: number;
    photo_type?: string;
    compliance_status?: string;
  }) => {
    const response = await apiClient.get('/compliance-photos', { params });
    return response.data;
  },

  getPhoto: async (photoId: number) => {
    const response = await apiClient.get(`/compliance-photos/${photoId}`);
    return response.data;
  },

  uploadPhoto: async (formData: FormData) => {
    const response = await apiClient.post('/compliance-photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updatePhoto: async (photoId: number, updateData: {
    photo_type?: string;
    tags?: any;
    compliance_status?: string;
    notes?: string;
  }) => {
    const response = await apiClient.patch(`/compliance-photos/${photoId}`, updateData);
    return response.data;
  },

  deletePhoto: async (photoId: number) => {
    const response = await apiClient.delete(`/compliance-photos/${photoId}`);
    return response.data;
  },

  downloadPhoto: async (photoId: number) => {
    const response = await apiClient.get(`/compliance-photos/${photoId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getDashboardStats: async () => {
    const response = await apiClient.get('/analytics/dashboard');
    return response.data;
  },

  getOrderStats: async (params?: {
    start_date?: string;
    end_date?: string;
    group_by?: 'day' | 'week' | 'month';
  }) => {
    const response = await apiClient.get('/analytics/orders', { params });
    return response.data;
  },

  getWorkerPerformance: async (params?: {
    start_date?: string;
    end_date?: string;
    worker_id?: number;
  }) => {
    const response = await apiClient.get('/analytics/worker-performance', { params });
    return response.data;
  },

  getComplianceStats: async (params?: {
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await apiClient.get('/analytics/compliance', { params });
    return response.data;
  },
};

// WebSocket connection handler
export const createWebSocketConnection = (onMessage?: (data: any) => void) => {
  const wsUrl = BASE_URL.replace('http', 'ws').replace('/api', '/ws');
  const token = localStorage.getItem('token');
  
  const ws = new WebSocket(`${wsUrl}?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) {
        onMessage(data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};

// Utility function to handle file downloads
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Export the configured axios instance for custom requests
export default apiClient;
