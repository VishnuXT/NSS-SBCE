import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  Calendar,
  Clock,
  Save,
  Plus,
  LogOut,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Download,
  Search,
} from "lucide-react";
import * as XLSX from 'xlsx';

// Assuming 'firebase.js' contains these functions
import {
  loginUser,
  registerUser,
  logoutUser,
  onAuthChange,
  addStudentToFirebase,
  getStudentsFromFirebase,
  updateStudentHours as updateStudentHoursFirebase,
} from "./firebase/firebase.js";

const AttendanceApp = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [students, setStudents] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    class: "",
    joinedYear: "",
  });
  const [hoursInput, setHoursInput] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });

  // New state for sorting configuration
  const [sortConfig, setSortConfig] = useState({
    key: "totalHours",
    direction: "descending",
  });

  // New state for search functionality
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        loadStudents();
      } else {
        setStudents([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadStudents = async () => {
    try {
      const result = await getStudentsFromFirebase();
      if (result.success) {
        setStudents(result.students);
      } else {
        showNotification(result.error, "error");
      }
    } catch (error) {
      showNotification("Failed to load students", "error");
    }
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 5000);
  };

  const handleAuthInputChange = (e) => {
    const { name, value } = e.target;
    setAuthData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (authError) setAuthError("");
  };

  const handleLogin = async () => {
    if (!authData.email || !authData.password) {
      setAuthError("Please fill in all fields");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    const result = await loginUser(authData.email, authData.password);
    if (result.success) {
      showNotification(result.message, "success");
      setAuthData({
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
      });
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(false);
  };

  const handleRegister = async () => {
    if (!authData.email || !authData.password) {
      setAuthError("Please fill in all fields");
      return;
    }
    if (authData.password.length < 6) {
      setAuthError("Password must be at least 6 characters long");
      return;
    }
    if (authData.password !== authData.confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    const result = await registerUser(
      authData.email,
      authData.password,
      authData.displayName
    );
    if (result.success) {
      showNotification(result.message, "success");
      setAuthData({
        email: "",
        password: "",
        confirmPassword: "",
        displayName: "",
      });
    } else {
      setAuthError(result.error);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result.success) {
      showNotification(result.message, "success");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHoursChange = (studentId, hours) => {
    setHoursInput((prev) => ({
      ...prev,
      [studentId]: hours,
    }));
  };

  const addStudent = async () => {
    if (!formData.name || !formData.class || !formData.joinedYear) {
      showNotification("Please fill in all student details", "error");
      return;
    }
    const studentData = {
      name: formData.name,
      class: formData.class,
      joinedYear: parseInt(formData.joinedYear),
      totalHours: 0,
    };
    const result = await addStudentToFirebase(studentData);
    if (result.success) {
      const newStudent = {
        id: result.id,
        ...studentData,
      };
      setStudents((prev) => [newStudent, ...prev]);
      setFormData({ name: "", class: "", joinedYear: "" });
      showNotification(result.message, "success");
    } else {
      showNotification(result.error, "error");
    }
  };

  const updateStudentHours = async (studentId) => {
    const addedHours = parseFloat(hoursInput[studentId] || 0);
    if (addedHours <= 0) {
      showNotification("Please enter hours greater than 0", "error");
      return;
    }
    const student = students.find((s) => s.id === studentId);
    const newTotalHours = (student.totalHours || 0) + addedHours;

    const result = await updateStudentHoursFirebase(studentId, addedHours); // backend should add hours
    if (result.success) {
      const updatedStudents = students.map((s) =>
        s.id === studentId ? { ...s, totalHours: newTotalHours } : s
      );
      setStudents(updatedStudents);
      setHoursInput((prev) => ({
        ...prev,
        [studentId]: "",
      }));
      showNotification(`Added ${addedHours} hours successfully`, "success");
    } else {
      showNotification(result.error, "error");
    }
  };

  // Excel download functionality
  const downloadExcel = () => {
    const dataToDownload = searchTerm ? filteredStudents : students;
    
    if (dataToDownload.length === 0) {
      showNotification("No data to download", "error");
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = dataToDownload.map((student, index) => ({
        'S.No': index + 1,
        'Student Name': student.name,
        'Class': student.class,
        'Joined Year': student.joinedYear,
        'Total Hours': student.totalHours || 0,
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      
      // Generate Excel file and trigger download
      const fileName = `student_attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      showNotification("Excel file downloaded successfully", "success");
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      showNotification("Failed to download Excel file", "error");
    }
  };

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    
    return students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  // Memoized sorting of students (now applied to filtered students)
  const sortedStudents = useMemo(() => {
    let sortableStudents = [...filteredStudents];
    if (sortConfig.key !== null) {
      sortableStudents.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableStudents;
  }, [filteredStudents, sortConfig]);

  // Function to handle the sorting request
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    } else if (
      sortConfig.key === key &&
      sortConfig.direction === "descending"
    ) {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#d5d6d7ff",
      padding: "20px",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    notification: {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 20px",
      borderRadius: "8px",
      color: "white",
      fontWeight: "500",
      zIndex: 1000,
      maxWidth: "300px",
      wordWrap: "break-word",
    },
    notificationSuccess: {
      backgroundColor: "#10b981",
    },
    notificationError: {
      backgroundColor: "#ef4444",
    },
    authContainer: {
      maxWidth: "420px",
      margin: "50px auto",
      backgroundColor: "white",
      borderRadius: "16px",
      boxShadow:
        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      padding: "40px 32px",
    },
    authHeader: {
      fontSize: "28px",
      fontWeight: "700",
      color: "#1f2937",
      textAlign: "center",
      marginBottom: "8px",
    },
    authSubheader: {
      fontSize: "16px",
      color: "#6b7280",
      textAlign: "center",
      marginBottom: "32px",
    },
    authForm: {
      display: "flex",
      flexDirection: "column",
      gap: "20px",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
    },
    label: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "6px",
    },
    inputWrapper: {
      position: "relative",
    },
    input: {
      width: "100%",
      padding: "12px 16px",
      border: "2px solid #e5e7eb",
      borderRadius: "8px",
      fontSize: "16px",
      outline: "none",
      transition: "border-color 0.2s ease",
      boxSizing: "border-box",
    },
    inputWithIcon: {
      width: "100%",
      paddingLeft: "44px",
      paddingRight: "16px",
      paddingTop: "12px",
      paddingBottom: "12px",
      border: "2px solid #e5e7eb",
      borderRadius: "8px",
      fontSize: "16px",
      outline: "none",
      transition: "border-color 0.2s ease",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#667eea",
    },
    inputIcon: {
      position: "absolute",
      left: "14px",
      top: "12px",
      color: "#9ca3af",
    },
    passwordToggle: {
      position: "absolute",
      right: "14px",
      top: "12px",
      cursor: "pointer",
      color: "#6b7280",
    },
    button: {
      width: "100%",
      backgroundColor: "#667eea",
      color: "white",
      padding: "14px 20px",
      border: "none",
      borderRadius: "8px",
      fontSize: "16px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    buttonHover: {
      backgroundColor: "#5a67d8",
    },
    buttonDisabled: {
      backgroundColor: "#9ca3af",
      cursor: "not-allowed",
    },
    errorMessage: {
      color: "#ef4444",
      fontSize: "14px",
      marginTop: "8px",
      textAlign: "center",
      padding: "8px",
      backgroundColor: "#fef2f2",
      borderRadius: "6px",
      border: "1px solid #fecaca",
    },
    switchMode: {
      textAlign: "center",
      marginTop: "24px",
      fontSize: "14px",
      color: "#6b7280",
    },
    switchLink: {
      color: "#667eea",
      cursor: "pointer",
      fontWeight: "600",
      textDecoration: "none",
    },
    mainWrapper: {
      maxWidth: "1200px",
      margin: "0 auto",
    },
    card: {
      backgroundColor: "white",
      borderRadius: "16px",
      boxShadow:
        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      padding: "32px",
      marginBottom: "24px",
    },
    header: {
      fontSize: "36px",
      fontWeight: "800",
      color: "#1f2937",
      textAlign: "center",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
    },
    userInfo: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#f8fafc",
      padding: "16px 20px",
      borderRadius: "12px",
      marginBottom: "32px",
    },
    userEmail: {
      fontSize: "16px",
      color: "#374151",
      fontWeight: "500",
    },
    logoutButton: {
      backgroundColor: "#ef4444",
      color: "white",
      padding: "8px 16px",
      border: "none",
      borderRadius: "6px",
      fontSize: "14px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontWeight: "500",
    },
    formSection: {
      backgroundColor: "#f8fafc",
      borderRadius: "12px",
      padding: "28px",
      marginBottom: "32px",
    },
    sectionTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#374151",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "20px",
    },
    addButton: {
      width: "100%",
      backgroundColor: "#10b981",
      color: "white",
      padding: "12px 16px",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    tableContainer: {
      backgroundColor: "white",
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      overflow: "hidden",
    },
    tableHeaderContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '20px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f8fafc',
    },
    tableTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#374151',
      margin: 0,
    },
    downloadButton: {
      backgroundColor: '#10b981',
      color: 'white',
      padding: '8px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: '500',
    },
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    searchContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    searchInput: {
      padding: '8px 12px 8px 36px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      outline: 'none',
      width: '250px',
    },
    searchIcon: {
      position: 'absolute',
      left: '10px',
      color: '#6b7280',
    },
    clearButton: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '12px',
      cursor: 'pointer',
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "16px 20px",
      textAlign: "left",
      fontSize: "12px",
      fontWeight: "600",
      color: "#6b7280",
      textTransform: "uppercase",
      backgroundColor: "#f8fafc",
      letterSpacing: "0.05em",
    },
    clickableTh: {
      padding: "16px 20px",
      textAlign: "left",
      fontSize: "12px",
      fontWeight: "600",
      color: "#6b7280",
      textTransform: "uppercase",
      backgroundColor: "#f8fafc",
      letterSpacing: "0.05em",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    td: {
      padding: "16px 20px",
      fontSize: "14px",
      borderBottom: "1px solid #f3f4f6",
    },
    studentInfo: {
      display: "flex",
      alignItems: "center",
    },
    avatar: {
      width: "40px",
      height: "40px",
      backgroundColor: "#dbeafe",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: "12px",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      backgroundColor: "#dcfce7",
      color: "#166534",
    },
    hoursUpdate: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    smallInput: {
      width: "90px",
      padding: "6px 10px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "14px",
      outline: "none",
    },
    smallButton: {
      backgroundColor: "#667eea",
      color: "white",
      padding: "6px 12px",
      border: "none",
      borderRadius: "6px",
      fontSize: "12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "4px",
      fontWeight: "500",
    },
    smallButtonDisabled: {
      backgroundColor: "#9ca3af",
      cursor: "not-allowed",
    },
    emptyState: {
      padding: "60px",
      textAlign: "center",
      color: "#6b7280",
    },
    loading: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontSize: "18px",
      color: "white",
      fontWeight: "500",
    },
    searchWrapper: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    },
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={styles.container}>
        {notification.message && (
          <div
            style={{
              ...styles.notification,
              ...(notification.type === "success"
                ? styles.notificationSuccess
                : styles.notificationError),
            }}
          >
            {notification.message}
          </div>
        )}
        <div style={styles.authContainer}>
          <h2 style={styles.authHeader}>
            {authMode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p style={styles.authSubheader}>
            {authMode === "login"
              ? "Sign in to your attendance system"
              : "Join the attendance tracking system"}
          </p>
          <div style={styles.authForm}>
            {authMode === "register" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Name (Optional)</label>
                <div style={styles.inputWrapper}>
                  <User style={styles.inputIcon} size={20} />
                  <input
                    type="text"
                    name="displayName"
                    value={authData.displayName}
                    onChange={handleAuthInputChange}
                    style={styles.inputWithIcon}
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
            )}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <div style={styles.inputWrapper}>
                <Mail style={styles.inputIcon} size={20} />
                <input
                  type="email"
                  name="email"
                  value={authData.email}
                  onChange={handleAuthInputChange}
                  style={styles.inputWithIcon}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrapper}>
                <Lock style={styles.inputIcon} size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={authData.password}
                  onChange={handleAuthInputChange}
                  style={styles.inputWithIcon}
                  placeholder="Enter your password"
                  required
                />
                <div
                  style={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </div>
              </div>
            </div>
            {authMode === "register" && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Confirm Password</label>
                <div style={styles.inputWrapper}>
                  <Lock style={styles.inputIcon} size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={authData.confirmPassword}
                    onChange={handleAuthInputChange}
                    style={styles.inputWithIcon}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}
            {authError && <div style={styles.errorMessage}>{authError}</div>}
            <button
              type="button"
              onClick={authMode === "login" ? handleLogin : handleRegister}
              disabled={authLoading}
              style={{
                ...styles.button,
                ...(authLoading ? styles.buttonDisabled : {}),
              }}
            >
              {authLoading
                ? "Please wait..."
                : authMode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {notification.message && (
        <div
          style={{
            ...styles.notification,
            ...(notification.type === "success"
              ? styles.notificationSuccess
              : styles.notificationError),
          }}
        >
          {notification.message}
        </div>
      )}
      <div style={styles.mainWrapper}>
        <div style={styles.card}>
          <div style={styles.userInfo}>
            <span style={styles.userEmail}>
              Welcome, {user.displayName || user.email}
            </span>
            <button style={styles.logoutButton} onClick={handleLogout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
          <h1 style={styles.header}>
            <Clock color="#667eea" /> Student Attendance System
          </h1>
          {/* Add Student Form */}
          <div style={styles.formSection}>
            <h2 style={styles.sectionTitle}>
              <Plus color="#10b981" /> Add New Student
            </h2>
            <div style={styles.formGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Student Name</label>
                <div style={styles.inputWrapper}>
                  <User style={styles.inputIcon} size={16} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter student name"
                    style={styles.inputWithIcon}
                    required
                  />
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Class</label>
                <input
                  type="text"
                  name="class"
                  value={formData.class}
                  onChange={handleInputChange}
                  placeholder="e.g., 10th Grade"
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Joined Year</label>
                <div style={styles.inputWrapper}>
                  <Calendar style={styles.inputIcon} size={16} />
                  <input
                    type="number"
                    name="joinedYear"
                    value={formData.joinedYear}
                    onChange={handleInputChange}
                    placeholder="2024"
                    min="2000"
                    max="2030"
                    style={styles.inputWithIcon}
                    required
                  />
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>&nbsp;</label>
                <button
                  type="button"
                  onClick={addStudent}
                  style={styles.addButton}
                >
                  <Plus size={16} /> Add Student
                </button>
              </div>
            </div>
          </div>
          {/* Student Details Table */}
          <div style={styles.tableContainer}>
            <div style={styles.tableHeaderContainer}>
              <h2 style={styles.tableTitle}>
                Student Details ({sortedStudents.length}
                {searchTerm && ` of ${students.length}`})
              </h2>
              {students.length > 0 && (
                <div style={styles.headerActions}>
                  {/* Search Input */}
                  <div style={styles.searchWrapper}>
                    <Search size={18} style={styles.searchIcon} />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      style={styles.searchInput}
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        style={styles.clearButton}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  <button 
                    style={styles.downloadButton} 
                    onClick={downloadExcel}
                    title="Download as Excel"
                  >
                    <Download size={16} /> Export to Excel
                  </button>
                </div>
              )}
            </div>
            {students.length === 0 ? (
              <div style={styles.emptyState}>
                <User size={64} color="#d1d5db" />
                <p
                  style={{
                    fontSize: "20px",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  No students added yet
                </p>
                <p style={{ fontSize: "16px", color: "#9ca3af" }}>
                  Add your first student using the form above
                </p>
              </div>
            ) : sortedStudents.length === 0 && searchTerm ? (
              <div style={styles.emptyState}>
                <Search size={64} color="#d1d5db" />
                <p
                  style={{
                    fontSize: "20px",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  No students found
                </p>
                <p style={{ fontSize: "16px", color: "#9ca3af" }}>
                  No students match your search for "{searchTerm}"
                </p>
                <button
                  onClick={clearSearch}
                  style={{
                    ...styles.button,
                    marginTop: '16px',
                    width: 'auto',
                    padding: '8px 16px',
                  }}
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Student Name</th>
                    <th style={styles.th}>Class</th>
                    <th style={styles.th}>Joined Year</th>
                    <th
                      style={styles.clickableTh}
                      onClick={() => requestSort("totalHours")}
                    >
                      Total Hours
                      {sortConfig.key === "totalHours" && (
                        <span style={{ fontSize: "12px", color: "#667eea" }}>
                          {sortConfig.direction === "ascending" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                    <th style={styles.th}>Update Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td style={{ color: "#1f2937", ...styles.td }}>
                        {index + 1}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.studentInfo}>
                          <div style={styles.avatar}>
                            <User color="#667eea" size={18} />
                          </div>
                          <span style={{ fontWeight: "600", color: "#1f2937" }}>
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: "#1f2937", ...styles.td }}>
                        {student.class}
                      </td>
                      <td style={{ color: "#1f2937", ...styles.td }}>
                        {student.joinedYear}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge}>
                          {student.totalHours} hours
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.hoursUpdate}>
                          <input
                            type="number"
                            value={hoursInput[student.id] || ""}
                            onChange={(e) =>
                              handleHoursChange(student.id, e.target.value)
                            }
                            placeholder="Hours"
                            style={styles.smallInput}
                            step="0.5"
                            min="0"
                          />
                          <button
                            onClick={() => updateStudentHours(student.id)}
                            disabled={!hoursInput[student.id]}
                            style={{
                              ...styles.smallButton,
                              ...(hoursInput[student.id]
                                ? {}
                                : styles.smallButtonDisabled),
                            }}
                          >
                            <Save size={14} /> Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceApp;