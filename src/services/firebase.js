import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  arrayUnion, 
  increment,
  getDoc,
  setDoc,
  limit
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Dynamic configuration check
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigValid = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.storageBucket;

let app;
let db;
let storage;
let auth;
let firebaseInitialized = false;

if (isConfigValid) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
    firebaseInitialized = true;
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase configuration missing or invalid. App will display developer setup screen.");
}

export { db, storage, auth, firebaseInitialized };

// --- Real Database Actions ---

/**
 * Subscribes to the real-time issues feed
 */
export const subscribeToIssues = (onUpdate, onError) => {
  if (!firebaseInitialized) return () => {};
  
  const q = query(collection(db, "issues"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const issuesList = [];
    snapshot.forEach((doc) => {
      issuesList.push({ id: doc.id, ...doc.data() });
    });
    onUpdate(issuesList);
  }, (error) => {
    console.error("Firestore subscription error:", error);
    if (onError) onError(error);
  });
};

/**
 * Uploads a base64 image (captured from camera canvas) or a File object to Firebase Storage
 */
export const uploadIssueImage = async (imageSrc, fileName) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");

  let blob;
  if (typeof imageSrc === 'string' && imageSrc.startsWith('data:')) {
    // Handle base64 canvas capture
    const byteString = atob(imageSrc.split(',')[1]);
    const mimeString = imageSrc.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    blob = new Blob([ab], { type: mimeString });
  } else if (imageSrc instanceof Blob) {
    blob = imageSrc;
  } else {
    throw new Error("Invalid image format. Expected base64 string or Blob/File.");
  }

  const imageRef = ref(storage, `issues/${fileName || `img_${Date.now()}.jpg`}`);
  const snapshot = await uploadBytes(imageRef, blob);
  return await getDownloadURL(snapshot.ref);
};

/**
 * Creates a new civic issue report in Firestore
 */
export const createIssue = async (issueData) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");

  const issue = {
    ...issueData,
    status: "Reported",
    verificationsCount: 0,
    verifiedUsers: [], // Store user IDs of citizens who verified
    comments: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await addDoc(collection(db, "issues"), issue);
  return { id: docRef.id, ...issue };
};

/**
 * Upvotes/Verifies an issue
 */
export const verifyIssue = async (issueId, userId) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");

  const issueRef = doc(db, "issues", issueId);
  await updateDoc(issueRef, {
    verificationsCount: increment(1),
    verifiedUsers: arrayUnion(userId),
    updatedAt: Date.now()
  });
};

/**
 * Adds a coordinate-based comment to an issue
 */
export const addComment = async (issueId, commentObj) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");

  const issueRef = doc(db, "issues", issueId);
  const comment = {
    ...commentObj,
    createdAt: Date.now()
  };
  
  await updateDoc(issueRef, {
    comments: arrayUnion(comment),
    updatedAt: Date.now()
  });
  return comment;
};

/**
 * Updates status of an issue (Admin Workflow)
 */
export const updateIssueStatus = async (issueId, status, afterPhotoUrl = null) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");

  const issueRef = doc(db, "issues", issueId);
  const updates = {
    status,
    updatedAt: Date.now()
  };

  if (status === "Resolved" && afterPhotoUrl) {
    updates.afterPhotoUrl = afterPhotoUrl;
    updates.resolvedAt = Date.now();
  }

  await updateDoc(issueRef, updates);
};

/**
 * Syncs the user's profile to Firestore
 */
export const syncUserProfile = async (userId, profileData) => {
  if (!firebaseInitialized) return;
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    ...profileData,
    userId,
    updatedAt: Date.now()
  }, { merge: true });
};

/**
 * Subscribes to the real-time leaderboard feed (sorted by XP desc)
 */
export const subscribeToLeaderboard = (onUpdate, onError) => {
  if (!firebaseInitialized) return () => {};
  
  const q = query(
    collection(db, "users"),
    orderBy("xp", "desc"),
    limit(10)
  );
  
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    onUpdate(list);
  }, (error) => {
    console.error("Leaderboard subscription error:", error);
    if (onError) onError(error);
  });
};

/**
 * Logs in municipal officers using Email and Password
 */
export const loginWithEmailAndPassword = async (email, password) => {
  if (!firebaseInitialized) throw new Error("Firebase not initialized");
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

/**
 * Retrieves user profile data from Firestore
 */
export const getUserProfile = async (userId) => {
  if (!firebaseInitialized) return null;
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};
