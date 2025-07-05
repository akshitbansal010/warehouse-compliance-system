import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - adjust based on your backend configuration
const BASE_URL = 'http://localhost:8000/api';

// Network timeout configuration
const TIMEOUT = 30000;

interface ApiResponse<T = any> {
  data: T;
  message?: string;
}

interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface OrderFilters {
  status?: string;
  priority?: string;
  worker_id?: number;
  date_from?: string;
  date_to?: string;
}

interface PackoutTaskData {
  order_id: number;
  steps_completed: Array<{
    step_id: number;
    completed: boolean;
    checklist_items: any[];
    photo_uri?: string;
  }>;
  compliance_photos: Array<{
    type: string;
    notes: string;
    timestamp: string;
  }>;
  completed_at: string;
  worker_notes?: string;
}

// Create axios instance with default configuration
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add authentication token
  client.interceptors.request.use(
    async (config: AxiosRequestConfig) => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Error retrieving token:', error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle common errors and token refresh
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // Handle 401 unauthorized errors
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          // Clear stored tokens
          await AsyncStorage.multiRemove(['access_token', 'token_type', 'username']);
          
          // Redirect to login or emit an event
          // Note: In React Native, you might want to use navigation or state management
          console.log('Authentication failed - user needs to login again');
        } catch (storageError) {
          console.error('Error clearing tokens:', storageError);
        }
      }

      // Handle network errors for offline support
      if (!error.response) {
        console.log('Network error - attempting offline fallback');
        // You can implement offline storage retrieval here
        return Promise.reject({
          ...error,
          isNetworkError: true,
          message: 'Network error. Please check your connection.',
        });
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create the API client instance
const apiClient = createApiClient();

// Token Management Functions
export const tokenManager = {
  async storeTokens(tokenData: TokenData, username?: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        ['access_token', tokenData.access_token],
        ['token_type', tokenData.token_type],
        ['token_expires_in', tokenData.expires_in.toString()],
        ...(username ? [['username', username]] : []),
      ]);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('access_token');
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['access_token', 'token_type', 'username', 'token_expires_in']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  },

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('access_token');
      return !!token;
    } catch (error) {
      return false;
    }
  },
};

// Offline Storage Manager
export const offlineStorage = {
  async storeOfflineData(key: string, data: any): Promise<void> {
    try {
      const offlineKey = `offline_${key}`;
      await AsyncStorage.setItem(offlineKey, JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  },

  async getOfflineData(key: string): Promise<any> {
    try {
      const offlineKey = `offline_${key}`;
      const storedData = await AsyncStorage.getItem(offlineKey);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        return parsed.data;
      }
      return null;
    } catch (error) {
      console.error('Error retrieving offline data:', error);
      return null;
    }
  },

  async clearOfflineData(key?: string): Promise<void> {
    try {
      if (key) {
        await AsyncStorage.removeItem(`offline_${key}`);
      } else {
        // Clear all offline data
        const keys = await AsyncStorage.getAllKeys();
        const offlineKeys = keys.filter(k => k.startsWith('offline_'));
        if (offlineKeys.length > 0) {
          await AsyncStorage.multiRemove(offlineKeys);
        }
      }
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  },

  async syncOfflineData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith('offline_'));
      
      for (const key of offlineKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          // Implement sync logic based on data type
          console.log(`Syncing offline data for key: ${key}`);
          // You can implement specific sync logic here
        }
      }
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  },
};

// Authentication API
export const authAPI = {
  async login(credentials: LoginCredentials): Promise<TokenData> {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const tokenData = response.data;
      
      // Store tokens locally
      await tokenManager.storeTokens(tokenData, credentials.username);
      
      return tokenData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      // Clear tokens and offline data
      await tokenManager.clearTokens();
      await offlineStorage.clearOfflineData();
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  async getCurrentUser(): Promise<any> {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  },
};

// Orders API
export const ordersAPI = {
  async getOrders(filters?: OrderFilters): Promise<any[]> {
    try {
      const response = await apiClient.get('/orders', { params: filters });
      
      // Store in offline storage
      await offlineStorage.storeOfflineData('orders', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Get orders error:', error);
      
      // Try to return offline data
      const offlineData = await offlineStorage.getOfflineData('orders');
      if (offlineData) {
        console.log('Returning offline orders data');
        return offlineData;
      }
      
      throw error;
    }
  },

  async getOrderByBarcode(barcode: string): Promise<any> {
    try {
      const response = await apiClient.get(`/orders/by-barcode/${barcode}`);
      return response.data;
    } catch (error) {
      console.error('Get order by barcode error:', error);
      throw error;
    }
  },

  async getOrder(orderId: number): Promise<any> {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Get order error:', error);
      throw error;
    }
  },

  async updateOrderStatus(orderId: number, status: string): Promise<any> {
    try {
      const response = await apiClient.patch(`/orders/${orderId}`, { status });
      return response.data;
    } catch (error) {
      console.error('Update order status error:', error);
      
      // Store for offline sync
      await offlineStorage.storeOfflineData(`order_status_update_${orderId}`, {
        orderId,
        status,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  },
};

// Packout Tasks API
export const packoutTasksAPI = {
  async getTasks(filters?: { worker_id?: number; status?: string }): Promise<any[]> {
    try {
      const response = await apiClient.get('/packout-tasks', { params: filters });
      
      // Store in offline storage
      await offlineStorage.storeOfflineData('packout_tasks', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Get packout tasks error:', error);
      
      // Try to return offline data
      const offlineData = await offlineStorage.getOfflineData('packout_tasks');
      if (offlineData) {
        console.log('Returning offline packout tasks data');
        return offlineData;
      }
      
      throw error;
    }
  },

  async createTask(taskData: {
    order_id: number;
    worker_id: number;
    routing_guide_id: number;
    instructions?: any;
  }): Promise<any> {
    try {
      const response = await apiClient.post('/packout-tasks', taskData);
      return response.data;
    } catch (error) {
      console.error('Create packout task error:', error);
      
      // Store for offline sync
      await offlineStorage.storeOfflineData(`create_task_${Date.now()}`, {
        ...taskData,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  },

  async updateTask(taskId: number, updateData: {
    status?: string;
    instructions?: any;
    steps_completed?: any;
    start_time?: string;
    end_time?: string;
  }): Promise<any> {
    try {
      const response = await apiClient.patch(`/packout-tasks/${taskId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Update packout task error:', error);
      
      // Store for offline sync
      await offlineStorage.storeOfflineData(`update_task_${taskId}`, {
        taskId,
        ...updateData,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  },

  async completeTask(taskData: PackoutTaskData): Promise<any> {
    try {
      const response = await apiClient.post('/packout-tasks/complete', taskData);
      return response.data;
    } catch (error) {
      console.error('Complete packout task error:', error);
      
      // Store for offline sync
      await offlineStorage.storeOfflineData(`complete_task_${taskData.order_id}_${Date.now()}`, {
        ...taskData,
        offline_timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  },
};

// Compliance Photos API
export const compliancePhotosAPI = {
  async uploadPhoto(formData: FormData): Promise<any> {
    try {
      const response = await apiClient.post('/compliance-photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // Longer timeout for file uploads
      });
      return response.data;
    } catch (error) {
      console.error('Upload compliance photo error:', error);
      throw error;
    }
  },

  async getPhotos(params?: {
    task_id?: number;
    photo_type?: string;
    compliance_status?: string;
  }): Promise<any[]> {
    try {
      const response = await apiClient.get('/compliance-photos', { params });
      return response.data;
    } catch (error) {
      console.error('Get compliance photos error:', error);
      throw error;
    }
  },

  async updatePhoto(photoId: number, updateData: {
    photo_type?: string;
    tags?: any;
    compliance_status?: string;
    notes?: string;
  }): Promise<any> {
    try {
      const response = await apiClient.patch(`/compliance-photos/${photoId}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Update compliance photo error:', error);
      throw error;
    }
  },
};

// Routing Guides API
export const routingGuidesAPI = {
  async getRoutingGuides(params?: {
    skip?: number;
    limit?: number;
    status?: string;
  }): Promise<any[]> {
    try {
      const response = await apiClient.get('/routing-guides', { params });
      
      // Store in offline storage
      await offlineStorage.storeOfflineData('routing_guides', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Get routing guides error:', error);
      
      // Try to return offline data
      const offlineData = await offlineStorage.getOfflineData('routing_guides');
      if (offlineData) {
        console.log('Returning offline routing guides data');
        return offlineData;
      }
      
      throw error;
    }
  },

  async getRoutingGuide(guideId: number): Promise<any> {
    try {
      const response = await apiClient.get(`/routing-guides/${guideId}`);
      return response.data;
    } catch (error) {
      console.error('Get routing guide error:', error);
      throw error;
    }
  },
};

// Worker Performance API
export const workerAPI = {
  async getWorkerStats(workerId?: number): Promise<any> {
    try {
      const endpoint = workerId ? `/workers/${workerId}/stats` : '/workers/me/stats';
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Get worker stats error:', error);
      throw error;
    }
  },

  async getWorkerTasks(workerId?: number, filters?: {
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<any[]> {
    try {
      const endpoint = workerId ? `/workers/${workerId}/tasks` : '/workers/me/tasks';
      const response = await apiClient.get(endpoint, { params: filters });
      return response.data;
    } catch (error) {
      console.error('Get worker tasks error:', error);
      throw error;
    }
  },
};

// Network status checker
export const networkUtils = {
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await apiClient.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  async syncPendingData(): Promise<void> {
    try {
      const isConnected = await this.checkConnectivity();
      if (isConnected) {
        await offlineStorage.syncOfflineData();
      }
    } catch (error) {
      console.error('Sync pending data error:', error);
    }
  },
};

// Export the main API client for custom requests
export default apiClient;

// Export all API modules
export {
  apiClient,
  authAPI,
  ordersAPI,
  packoutTasksAPI,
  compliancePhotosAPI,
  routingGuidesAPI,
  workerAPI,
  networkUtils,
};
