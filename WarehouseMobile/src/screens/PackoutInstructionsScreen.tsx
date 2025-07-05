import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface PackoutInstructionsScreenProps {
  navigation: any;
  route: {
    params: {
      order: any;
      scannedCode: string;
    };
  };
}

interface PackoutStep {
  id: number;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  photoRequired: boolean;
  photoTaken: boolean;
  photoUri?: string;
  instructions: string[];
  checklistItems: Array<{
    id: number;
    text: string;
    completed: boolean;
  }>;
}

interface CompliancePhoto {
  uri: string;
  type: 'package' | 'label' | 'damage' | 'compliance';
  notes: string;
  timestamp: Date;
}

const { width, height } = Dimensions.get('window');

const PackoutInstructionsScreen: React.FC<PackoutInstructionsScreenProps> = ({
  navigation,
  route,
}) => {
  const { order, scannedCode } = route.params;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<'package' | 'label' | 'damage' | 'compliance'>('package');
  const [photoNotes, setPhotoNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const cameraRef = useRef<RNCamera>(null);

  const [packoutSteps, setPackoutSteps] = useState<PackoutStep[]>([
    {
      id: 1,
      title: 'Verify Order Items',
      description: 'Check all items against the order list',
      required: true,
      completed: false,
      photoRequired: true,
      photoTaken: false,
      instructions: [
        'Scan or verify each item SKU',
        'Check quantities match order',
        'Inspect items for damage',
        'Set aside any damaged items',
      ],
      checklistItems: [
        { id: 1, text: 'All items present', completed: false },
        { id: 2, text: 'Quantities correct', completed: false },
        { id: 3, text: 'No visible damage', completed: false },
      ],
    },
    {
      id: 2,
      title: 'Select Packaging',
      description: 'Choose appropriate packaging materials',
      required: true,
      completed: false,
      photoRequired: true,
      photoTaken: false,
      instructions: [
        'Select box size based on items',
        'Use bubble wrap for fragile items',
        'Add sufficient padding material',
        'Ensure box can close properly',
      ],
      checklistItems: [
        { id: 1, text: 'Correct box size selected', completed: false },
        { id: 2, text: 'Protective materials added', completed: false },
        { id: 3, text: 'Box closes securely', completed: false },
      ],
    },
    {
      id: 3,
      title: 'Pack Items',
      description: 'Carefully pack all items in the container',
      required: true,
      completed: false,
      photoRequired: true,
      photoTaken: false,
      instructions: [
        'Place heavier items at bottom',
        'Wrap fragile items individually',
        'Fill empty spaces with padding',
        'Ensure nothing moves when shaken',
      ],
      checklistItems: [
        { id: 1, text: 'Items packed securely', completed: false },
        { id: 2, text: 'No movement in package', completed: false },
        { id: 3, text: 'Fragile items protected', completed: false },
      ],
    },
    {
      id: 4,
      title: 'Apply Labels',
      description: 'Attach shipping and handling labels',
      required: true,
      completed: false,
      photoRequired: true,
      photoTaken: false,
      instructions: [
        'Print shipping label',
        'Apply label to largest flat surface',
        'Add fragile stickers if needed',
        'Attach return label inside package',
      ],
      checklistItems: [
        { id: 1, text: 'Shipping label applied correctly', completed: false },
        { id: 2, text: 'Address clearly visible', completed: false },
        { id: 3, text: 'Special handling labels added', completed: false },
      ],
    },
    {
      id: 5,
      title: 'Final Inspection',
      description: 'Perform final quality check',
      required: true,
      completed: false,
      photoRequired: true,
      photoTaken: false,
      instructions: [
        'Verify all labels are secure',
        'Check package integrity',
        'Confirm order details match',
        'Take final compliance photo',
      ],
      checklistItems: [
        { id: 1, text: 'Package sealed properly', completed: false },
        { id: 2, text: 'All labels secure', completed: false },
        { id: 3, text: 'Final inspection passed', completed: false },
      ],
    },
  ]);

  const [compliancePhotos, setCompliancePhotos] = useState<CompliancePhoto[]>([]);

  useEffect(() => {
    // Load any existing progress for this order
    loadPackoutProgress();
  }, []);

  const loadPackoutProgress = async () => {
    try {
      const savedProgress = await AsyncStorage.getItem(`packout_${order.id}`);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        setPackoutSteps(progress.steps || packoutSteps);
        setCompliancePhotos(progress.photos || []);
        setCurrentStepIndex(progress.currentStep || 0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const savePackoutProgress = async () => {
    try {
      const progress = {
        steps: packoutSteps,
        photos: compliancePhotos,
        currentStep: currentStepIndex,
        lastUpdated: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`packout_${order.id}`, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleChecklistItemToggle = (stepIndex: number, itemId: number) => {
    const updatedSteps = [...packoutSteps];
    const step = updatedSteps[stepIndex];
    const item = step.checklistItems.find(item => item.id === itemId);
    
    if (item) {
      item.completed = !item.completed;
      
      // Check if all checklist items are completed
      const allItemsCompleted = step.checklistItems.every(item => item.completed);
      const photoCompleted = !step.photoRequired || step.photoTaken;
      
      step.completed = allItemsCompleted && photoCompleted;
      
      setPackoutSteps(updatedSteps);
      savePackoutProgress();
    }
  };

  const handleTakePhoto = (photoType: 'package' | 'label' | 'damage' | 'compliance') => {
    setCameraType(photoType);
    setPhotoNotes('');
    setShowCamera(true);
  };

  const handleCameraCapture = async ({ uri }: { uri: string }) => {
    try {
      const updatedSteps = [...packoutSteps];
      const currentStep = updatedSteps[currentStepIndex];
      
      // Mark photo as taken for current step
      currentStep.photoTaken = true;
      currentStep.photoUri = uri;
      
      // Check if step is now completed
      const allItemsCompleted = currentStep.checklistItems.every(item => item.completed);
      currentStep.completed = allItemsCompleted && currentStep.photoTaken;
      
      // Add to compliance photos
      const compliancePhoto: CompliancePhoto = {
        uri,
        type: cameraType,
        notes: photoNotes,
        timestamp: new Date(),
      };
      
      setPackoutSteps(updatedSteps);
      setCompliancePhotos(prev => [...prev, compliancePhoto]);
      setShowCamera(false);
      
      await savePackoutProgress();
      
      Alert.alert('Success', 'Photo captured successfully!');
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleNextStep = () => {
    const currentStep = packoutSteps[currentStepIndex];
    
    if (!currentStep.completed) {
      Alert.alert(
        'Step Incomplete',
        'Please complete all checklist items and take required photos before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (currentStepIndex < packoutSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      savePackoutProgress();
    } else {
      // All steps completed
      setShowCompletionModal(true);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      savePackoutProgress();
    }
  };

  const handleSubmitPackout = async () => {
    setSubmitting(true);
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      
      // Prepare submission data
      const submissionData = {
        order_id: order.id,
        steps_completed: packoutSteps.map(step => ({
          step_id: step.id,
          completed: step.completed,
          checklist_items: step.checklistItems,
          photo_uri: step.photoUri,
        })),
        compliance_photos: compliancePhotos.map(photo => ({
          type: photo.type,
          notes: photo.notes,
          timestamp: photo.timestamp.toISOString(),
        })),
        completed_at: new Date().toISOString(),
        worker_notes: '',
      };
      
      // Submit to API
      await axios.post(
        'http://localhost:8000/api/packout-tasks/complete',
        submissionData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Clear saved progress
      await AsyncStorage.removeItem(`packout_${order.id}`);
      
      Alert.alert(
        'Success!',
        'Packout completed successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Scanner'),
          },
        ]
      );
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert(
        'Submission Failed',
        'Failed to submit packout. Data has been saved locally.',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
      setShowCompletionModal(false);
    }
  };

  const renderStepProgress = () => (
    <View style={styles.progressContainer}>
      <Text style={styles.progressText}>
        Step {currentStepIndex + 1} of {packoutSteps.length}
      </Text>
      <View style={styles.progressBar}>
        {packoutSteps.map((step, index) => (
          <View
            key={step.id}
            style={[
              styles.progressDot,
              {
                backgroundColor: step.completed
                  ? '#10B981'
                  : index === currentStepIndex
                  ? '#3B82F6'
                  : '#E5E7EB',
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    const currentStep = packoutSteps[currentStepIndex];
    
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{currentStep.title}</Text>
        <Text style={styles.stepDescription}>{currentStep.description}</Text>
        
        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.sectionTitle}>Instructions:</Text>
          {currentStep.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <Text style={styles.instructionBullet}>•</Text>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
        
        {/* Checklist */}
        <View style={styles.checklistContainer}>
          <Text style={styles.sectionTitle}>Checklist:</Text>
          {currentStep.checklistItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.checklistItem}
              onPress={() => handleChecklistItemToggle(currentStepIndex, item.id)}
            >
              <View style={[styles.checkbox, item.completed && styles.checkboxCompleted]}>
                {item.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checklistText, item.completed && styles.checklistTextCompleted]}>
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Photo Section */}
        {currentStep.photoRequired && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Required Photo:</Text>
            {currentStep.photoTaken && currentStep.photoUri ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: currentStep.photoUri }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleTakePhoto('package')}
                >
                  <Text style={styles.retakeButtonText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={() => handleTakePhoto('package')}
              >
                <Text style={styles.photoButtonText}>📷 Take Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Additional Photo Options */}
        <View style={styles.additionalPhotosSection}>
          <Text style={styles.sectionTitle}>Additional Photos (Optional):</Text>
          <View style={styles.photoButtonsRow}>
            <TouchableOpacity
              style={styles.smallPhotoButton}
              onPress={() => handleTakePhoto('damage')}
            >
              <Text style={styles.smallPhotoButtonText}>Damage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallPhotoButton}
              onPress={() => handleTakePhoto('compliance')}
            >
              <Text style={styles.smallPhotoButtonText}>Compliance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderNavigationButtons = () => (
    <View style={styles.navigationContainer}>
      <TouchableOpacity
        style={[styles.navButton, currentStepIndex === 0 && styles.navButtonDisabled]}
        onPress={handlePreviousStep}
        disabled={currentStepIndex === 0}
      >
        <Text style={styles.navButtonText}>Previous</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.navButton,
          styles.nextButton,
          !packoutSteps[currentStepIndex].completed && styles.navButtonDisabled,
        ]}
        onPress={handleNextStep}
        disabled={!packoutSteps[currentStepIndex].completed}
      >
        <Text style={styles.navButtonText}>
          {currentStepIndex === packoutSteps.length - 1 ? 'Complete' : 'Next'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCamera = () => (
    <Modal visible={showCamera} animationType="slide">
      <View style={styles.cameraContainer}>
        <RNCamera
          ref={cameraRef}
          style={styles.camera}
          type={RNCamera.Constants.Type.back}
          flashMode={RNCamera.Constants.FlashMode.auto}
          androidCameraPermissionOptions={{
            title: 'Permission to use camera',
            message: 'We need your permission to use your camera',
            buttonPositive: 'Ok',
            buttonNegative: 'Cancel',
          }}
        />
        
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Take {cameraType} Photo</Text>
            <View style={styles.placeholder} />
          </View>
          
          <View style={styles.cameraFooter}>
            <TextInput
              style={styles.notesInput}
              value={photoNotes}
              onChangeText={setPhotoNotes}
              placeholder="Add notes (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            
            <TouchableOpacity
              style={styles.captureButton}
              onPress={async () => {
                if (cameraRef.current) {
                  const options = { quality: 0.5, base64: false };
                  const data = await cameraRef.current.takePictureAsync(options);
                  handleCameraCapture(data);
                }
              }}
            >
              <Text style={styles.captureButtonText}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderCompletionModal = () => (
    <Modal visible={showCompletionModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.completionModal}>
          <Text style={styles.completionTitle}>Packout Complete!</Text>
          <Text style={styles.completionText}>
            All steps have been completed successfully.
          </Text>
          
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Summary:</Text>
            <Text style={styles.summaryItem}>• {packoutSteps.length} steps completed</Text>
            <Text style={styles.summaryItem}>• {compliancePhotos.length} photos taken</Text>
            <Text style={styles.summaryItem}>• Order #{order.order_number}</Text>
          </View>
          
          <View style={styles.completionActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCompletionModal(false)}
            >
              <Text style={styles.cancelButtonText}>Review</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitPackout}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          <Text style={styles.customerName}>{order.customer_info.name}</Text>
        </View>
        
        {/* Progress */}
        {renderStepProgress()}
        
        {/* Current Step */}
        {renderCurrentStep()}
      </ScrollView>
      
      {/* Navigation */}
      {renderNavigationButtons()}
      
      {/* Camera Modal */}
      {renderCamera()}
      
      {/* Completion Modal */}
      {renderCompletionModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  customerName: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  stepContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  instructionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  instructionBullet: {
    fontSize: 16,
    color: '#3B82F6',
    marginRight: 8,
    marginTop: 2,
  },
  instructionText: {
    fontSize: 16,
    color: '#4B5563',
    flex: 1,
    lineHeight: 24,
  },
  checklistContainer: {
    marginBottom: 24,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checklistText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  photoSection: {
    marginBottom: 24,
  },
  photoContainer: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  retakeButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retakeButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  photoButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  additionalPhotosSection: {
    marginBottom: 24,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  smallPhotoButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  smallPhotoButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  nextButton: {
    backgroundColor: '#3B82F6',
  },
  navButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  cameraFooter: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
    alignItems: 'center',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 20,
    fontSize: 16,
    maxHeight: 80,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  completionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  completionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  summaryItem: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  completionActions: {
    flexDirection: 'row',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PackoutInstructionsScreen;
