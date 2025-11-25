import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

// Mock reward data for the marketplace
const mockRewards = [
  {
    name: 'Fitbit Inspire 3',
    brand: 'Fitbit',
    imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400',
    pointsRequired: 5000,
    available: true,
  },
  {
    name: 'Yoga Mat Premium',
    brand: 'Lululemon',
    imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400',
    pointsRequired: 2000,
    available: true,
  },
  {
    name: 'Protein Powder 2lb',
    brand: 'Optimum Nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400',
    pointsRequired: 1500,
    available: true,
  },
  {
    name: 'Water Bottle 32oz',
    brand: 'Hydro Flask',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400',
    pointsRequired: 1000,
    available: true,
  },
  {
    name: 'Running Shoes',
    brand: 'Nike',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    pointsRequired: 8000,
    available: true,
  },
  {
    name: 'Massage Gun',
    brand: 'Theragun',
    imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400',
    pointsRequired: 10000,
    available: true,
  },
  {
    name: 'Bluetooth Headphones',
    brand: 'Sony',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    pointsRequired: 6000,
    available: true,
  },
  {
    name: 'Smart Scale',
    brand: 'Withings',
    imageUrl: 'https://images.unsplash.com/photo-1591081292445-8b7e3dc5fcc2?w=400',
    pointsRequired: 3500,
    available: true,
  },
  {
    name: 'Resistance Bands Set',
    brand: 'TheraBand',
    imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=400',
    pointsRequired: 800,
    available: true,
  },
  {
    name: 'Meal Prep Containers',
    brand: 'Prep Naturals',
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400',
    pointsRequired: 500,
    available: true,
  },
  {
    name: 'Vitamins Bundle',
    brand: 'Nature Made',
    imageUrl: 'https://images.unsplash.com/photo-1550572017-4870c1d25938?w=400',
    pointsRequired: 1200,
    available: true,
  },
  {
    name: 'Foam Roller',
    brand: 'TriggerPoint',
    imageUrl: 'https://images.unsplash.com/photo-1591228127791-8e2eaef098d3?w=400',
    pointsRequired: 700,
    available: true,
  },
];

export async function seedRewards() {
  try {
    console.log('Seeding reward marketplace...');
    
    for (const reward of mockRewards) {
      await addDoc(collection(db, 'rewardMarketplace'), reward);
      console.log(`Added: ${reward.name}`);
    }
    
    console.log('✅ Successfully seeded all rewards!');
  } catch (error) {
    console.error('Error seeding rewards:', error);
  }
}

// Uncomment and run this in browser console to seed data:
// import { seedRewards } from '@/lib/seedRewards';
// seedRewards();
