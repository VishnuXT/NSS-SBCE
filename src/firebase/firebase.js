// firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";

// Your Firebase configuration - Replace with your actual config
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLFG1jhK0UtfB-em2GxqnPBd3dgzgKeUM",
  authDomain: "nss-sbce.firebaseapp.com",
  projectId: "nss-sbce",
  storageBucket: "nss-sbce.firebasestorage.app",
  messagingSenderId: "929939544235",
  appId: "1:929939544235:web:0dc7014a4332ab24c53fee"
};

// ----------------------
// Initialize Firebase
// ----------------------
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ----------------------
// AUTH FUNCTIONS
// ----------------------
export const registerUser = async (email, password, displayName = null) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    return {
      success: true,
      user: userCredential.user,
      message: "Account created successfully!",
    };
  } catch (error) {
    console.error("Registration error:", error);
    let errorMessage = "Registration failed. Please try again.";

    switch (error.code) {
      case "auth/email-already-in-use":
        errorMessage = "This email is already registered.";
        break;
      case "auth/weak-password":
        errorMessage = "Password should be at least 6 characters long.";
        break;
      case "auth/invalid-email":
        errorMessage = "Please enter a valid email address.";
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return {
      success: true,
      user: userCredential.user,
      message: "Login successful!",
    };
  } catch (error) {
    console.error("Login error:", error);
    let errorMessage = "Login failed. Please try again.";

    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "No account found with this email.";
        break;
      case "auth/wrong-password":
        errorMessage = "Incorrect password.";
        break;
      case "auth/invalid-email":
        errorMessage = "Please enter a valid email address.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Too many failed login attempts. Try again later.";
        break;
      default:
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true, message: "Logged out successfully!" };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: "Failed to logout. Please try again." };
  }
};

// Listen to authentication state changes
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => auth.currentUser;

// ----------------------
// STUDENT FUNCTIONS
// ----------------------
export const addStudentToFirebase = async (studentData) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("User must be authenticated to add students");
    }

    const docRef = await addDoc(collection(db, "students"), {
      ...studentData,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      id: docRef.id,
      message: "Student added successfully!",
    };
  } catch (error) {
    console.error("Error adding student:", error);
    return { success: false, error: error.message };
  }
};

export const getStudentsFromFirebase = async () => {
  try {
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const students = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, students };
  } catch (error) {
    console.error("Error fetching students:", error);
    return { success: false, error: error.message };
  }
};

export const updateStudentHours = async (studentId, addedHours) => {
  try {
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      throw new Error("Student not found");
    }

    const currentHours = studentSnap.data().totalHours || 0;
    const newTotal = currentHours + addedHours;

    await updateDoc(studentRef, {
      totalHours: newTotal,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: "Student hours updated successfully!" };
  } catch (error) {
    console.error("Error updating student hours:", error);
    return { success: false, error: error.message };
  }
};