import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface ScannerScreenProps {
  navigation: any;
  route?: any;
}

interface ScannedOrder {
  id: number;
  order_number: string;
  customer_info: {
    name: string;
    email: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
  }>;
  status: string;
  priority: string;
}

const { width, height } = Dimensions.get('window');

const ScannerScreen: React.FC<ScannerScreenProps> = ({ navigation, route }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(true);
  const [flashMode, setFlashMode] = useState(RNCamera.Constants.FlashMode.off);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<ScannedOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const cameraRef = useRef<RNCamera>(null);

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      const status = await RNCamera.getCameraPermissionStatus();
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        const result = await RNCamera.requestCameraPermission();
        setHasPermission(result === 'granted');
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasPermission(false);
    }
  };

  const handleBarCodeRead = async (scanResult: any) => {
    if (!scanning || loading) return;

    const { data, type } = scanResult;
    
    // Vibrate on successful scan
    Vibration.vibrate(100);
    
    setScanning(false);
    setScannedData(data);
    setLoading(true);

    try {
      await fetchOrderData(data);
    } catch (error) {
      console.error('Scan processing error:', error);
      Alert.alert(
        'Scan Error',
        'Failed to process the scanned code. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setScanning(true);
              setScannedData(null);
              setLoading(false);
            },
          },
        ]
      );
    }
  };

  const fetchOrderData = async (barcode: string) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.get(`http://localhost:8000/api/orders/by-barcode/${barcode}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setOrderData(response.data);
      setShowOrderModal(true);
    } catch (error: any) {
      console.error('API error:', error);
      
      // Mock data for development/demo purposes
      const mockOrder: ScannedOrder = {
        id: 1,
        order_number: `ORD-${barcode.slice(-6)}`,
        customer_info: {
          name: 'John Smith',
          email: 'john.smith@example.com',
        },
        items: [
          {
            sku: 'SKU-001',
            name: 'Product A',
            quantity: 2,
          },
          {
            sku: 'SKU-002',
            name: 'Product B',
            quantity: 1,
          },
        ],
        status: 'pending',
        priority: 'normal',
      };

      setOrderData(mockOrder);
      setShowOrderModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = () => {
    if (orderData) {
      setShowOrderModal(false);
      navigation.navigate('PackoutInstructions', {
        order: orderData,
        scannedCode: scannedData,
      });
    }
  };

  const handleRescan = () => {
    setShowOrderModal(false);
    setOrderData(null);
    setScannedData(null);
    setScanning(true);
  };

  const toggleFlash = () => {
    setFlashMode(
      flashMode === RNCamera.Constants.FlashMode.off
        ? RNCamera.Constants.FlashMode.torch
        : RNCamera.Constants.FlashMode.off
    );
  };

  const renderScanOverlay = () => (
    <View style={styles.overlay}>
      <View style={styles.overlayTop} />
      <View style={styles.overlayMiddle}>
        <View style={styles.overlaySide} />
        <View style={styles.scanArea}>
          <View style={styles.scanCorners}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          {scanning && (
            <View style={styles.scanLine} />
          )}
        </View>
        <View style={styles.overlaySide} />
      </View>
      <View style={styles.overlayBottom}>
        <Text style={styles.instructionText}>
          {loading ? 'Processing...' : 'Point camera at barcode or QR code'}
        </Text>
      </View>
    </View>
  );

  const renderOrderModal = () => (
    <Modal
      visible={showOrderModal}
      animationType="slide"
      transparent={true}
      onRequestClose={handleRescan}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Found</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleRescan}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {orderData && (
            <View style={styles.orderDetails}>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Order Number:</Text>
                <Text style={styles.orderValue}>{orderData.order_number}</Text>
              </View>
              
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Customer:</Text>
                <Text style={styles.orderValue}>{orderData.customer_info.name}</Text>
              </View>
              
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Status:</Text>
                <View style={[styles.statusBadge, getStatusStyle(orderData.status)]}>
                  <Text style={styles.statusText}>{orderData.status.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Priority:</Text>
                <View style={[styles.priorityBadge, getPriorityStyle(orderData.priority)]}>
                  <Text style={styles.priorityText}>{orderData.priority.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.itemsSection}>
                <Text style={styles.itemsLabel}>Items ({orderData.items.length}):</Text>
                {orderData.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemSKU}>{item.sku}</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={handleRescan}
            >
              <Text style={styles.rescanButtonText}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleOrderSelect}
            >
              <Text style={styles.continueButtonText}>Start Packout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return { backgroundColor: '#FEF3C7' };
      case 'processing':
        return { backgroundColor: '#DBEAFE' };
      case 'completed':
        return { backgroundColor: '#D1FAE5' };
      default:
        return { backgroundColor: '#F3F4F6' };
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return { backgroundColor: '#FEE2E2' };
      case 'high':
        return { backgroundColor: '#FED7AA' };
      case 'normal':
        return { backgroundColor: '#E0E7FF' };
      case 'low':
        return { backgroundColor: '#F3F4F6' };
      default:
        return { backgroundColor: '#F3F4F6' };
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission is required to scan barcodes</Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkCameraPermission}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={flashMode}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera to scan barcodes',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        onBarCodeRead={handleBarCodeRead}
        barCodeTypes={[
          RNCamera.Constants.BarCodeType.qr,
          RNCamera.Constants.BarCodeType.ean13,
          RNCamera.Constants.BarCodeType.ean8,
          RNCamera.Constants.BarCodeType.code128,
          RNCamera.Constants.BarCodeType.code39,
          RNCamera.Constants.BarCodeType.code93,
          RNCamera.Constants.BarCodeType.codabar,
          RNCamera.Constants.BarCodeType.upc_e,
        ]}
      >
        {renderScanOverlay()}
      </RNCamera>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <Text style={styles.controlButtonText}>
            {flashMode === RNCamera.Constants.FlashMode.off ? '💡' : '🔦'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.controlButtonText}>❌</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingOverlayText}>Processing scan...</Text>
        </View>
      )}

      {renderOrderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 250,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  scanCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#3B82F6',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3B82F6',
    opacity: 0.8,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  controls: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'column',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  controlButtonText: {
    fontSize: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6B7280',
  },
  orderDetails: {
    padding: 20,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  orderValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  itemsSection: {
    marginTop: 16,
  },
  itemsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemSKU: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 2,
    marginHorizontal: 8,
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  rescanButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScannerScreen;
