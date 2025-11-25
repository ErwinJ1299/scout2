import { adminDb } from "@/lib/firebase-admin";
import { MedicineOrder, PrescriptionUpload } from "@/types";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Create a new medicine order
 * @param order - Medicine order data
 * @returns Created order with ID
 */
export async function createOrder(order: Omit<MedicineOrder, 'id'>): Promise<MedicineOrder> {
  try {
    const orderData = {
      ...order,
      createdAt: order.createdAt instanceof Date 
        ? Timestamp.fromDate(order.createdAt)
        : Timestamp.now(),
    };

    const docRef = await adminDb.collection('medicineOrders').add(orderData);
    
    return {
      id: docRef.id,
      ...order,
      createdAt: order.createdAt || new Date(),
    };
  } catch (error) {
    console.error('Error creating medicine order:', error);
    throw error;
  }
}

/**
 * Get medicine orders for a user
 * @param userId - User ID
 * @param limit - Maximum number of orders to return (default: 20)
 * @returns Array of medicine orders
 */
export async function getOrdersForUser(
  userId: string,
  limit: number = 20
): Promise<MedicineOrder[]> {
  try {
    const snapshot = await adminDb
      .collection('medicineOrders')
      .where('userId', '==', userId)
      .limit(limit)
      .get();

    const orders: MedicineOrder[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        userId: data.userId,
        medicineName: data.medicineName,
        source: data.source,
        partner: data.partner,
        redirectUrl: data.redirectUrl,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        noteId: data.noteId,
        prescriptionId: data.prescriptionId,
      });
    });

    // Sort by createdAt (most recent first) in memory
    orders.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return orders;
  } catch (error) {
    console.error('Error fetching medicine orders:', error);
    throw error;
  }
}

/**
 * Create a prescription upload record
 * @param upload - Prescription upload data
 * @returns Created upload with ID
 */
export async function createPrescriptionUpload(
  upload: Omit<PrescriptionUpload, 'id'>
): Promise<PrescriptionUpload> {
  try {
    const uploadData = {
      ...upload,
      createdAt: upload.createdAt instanceof Date
        ? Timestamp.fromDate(upload.createdAt)
        : Timestamp.now(),
    };

    const docRef = await adminDb.collection('prescriptionUploads').add(uploadData);

    return {
      id: docRef.id,
      ...upload,
      createdAt: upload.createdAt || new Date(),
    };
  } catch (error) {
    console.error('Error creating prescription upload:', error);
    throw error;
  }
}

/**
 * Get prescription uploads for a user
 * @param userId - User ID
 * @param limit - Maximum number of uploads to return (default: 20)
 * @returns Array of prescription uploads
 */
export async function getPrescriptionUploadsForUser(
  userId: string,
  limit: number = 20
): Promise<PrescriptionUpload[]> {
  try {
    const snapshot = await adminDb
      .collection('prescriptionUploads')
      .where('userId', '==', userId)
      .limit(limit)
      .get();

    const uploads: PrescriptionUpload[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      uploads.push({
        id: doc.id,
        userId: data.userId,
        filePath: data.filePath,
        extractedMedicines: data.extractedMedicines,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
      });
    });

    // Sort by createdAt (most recent first) in memory
    uploads.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return uploads;
  } catch (error) {
    console.error('Error fetching prescription uploads:', error);
    throw error;
  }
}

/**
 * Get a single medicine order by ID
 * @param orderId - Order ID
 * @returns Medicine order or null if not found
 */
export async function getOrderById(orderId: string): Promise<MedicineOrder | null> {
  try {
    const doc = await adminDb.collection('medicineOrders').doc(orderId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      id: doc.id,
      userId: data.userId,
      medicineName: data.medicineName,
      source: data.source,
      partner: data.partner,
      redirectUrl: data.redirectUrl,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      noteId: data.noteId,
      prescriptionId: data.prescriptionId,
    };
  } catch (error) {
    console.error('Error fetching medicine order:', error);
    throw error;
  }
}

/**
 * Get a single prescription upload by ID
 * @param uploadId - Upload ID
 * @returns Prescription upload or null if not found
 */
export async function getPrescriptionUploadById(uploadId: string): Promise<PrescriptionUpload | null> {
  try {
    const doc = await adminDb.collection('prescriptionUploads').doc(uploadId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      id: doc.id,
      userId: data.userId,
      filePath: data.filePath,
      extractedMedicines: data.extractedMedicines,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
    };
  } catch (error) {
    console.error('Error fetching prescription upload:', error);
    throw error;
  }
}
