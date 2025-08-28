import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface Center {
  id: string;
  name: string;
  isHeadOffice?: boolean;
  // ... other properties
}

/**
 * Get the head office center from Firestore
 * Returns the first center marked as head office, or null if none found
 */
export const getHeadOfficeCenter = async (): Promise<Center | null> => {
  try {
    const centersQuery = collection(db, 'centers');
    const querySnapshot = await getDocs(centersQuery);
    
    const centers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Center[];
    
    // Find the center marked as head office
    const headOffice = centers.find(center => center.isHeadOffice);
    
    return headOffice || null;
  } catch (error) {
    console.error('Error fetching head office:', error);
    return null;
  }
};

/**
 * Get the head office ID, with fallback to 'rohini' for backward compatibility
 */
export const getHeadOfficeId = async (): Promise<string> => {
  const headOffice = await getHeadOfficeCenter();
  return headOffice?.id || 'rohini'; // Fallback to rohini for backward compatibility
};
