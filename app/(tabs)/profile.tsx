import Typo from "@/components/Typo";
import { auth, db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const router = useRouter();

  // Account settings state
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch user data on component mount
  useEffect(() => {
    if (user) {
      console.log("Fetching user data for:", user.uid);
      fetchUserData();
    }
  }, [user]);

  // Force refresh data when component mounts - helps with cross-platform sync
  useEffect(() => {
    const refreshUserData = async () => {
      if (user) {
        console.log("Forcing refresh of user data");
        setProfilePhoto(null);
        setCoverPhoto(null);
        await fetchUserData();
      }
    };

    refreshUserData();
  }, []);

  const fetchUserData = async () => {
    if (!user) return;

    setFetchingData(true);
    try {
      console.log("Fetching user document from Firestore...");
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("User document found:", userData.username);
        setUsername(userData.username || user.displayName || "User");
        setBio(userData.bio || "");

        if (userData.profileUrl) {
          console.log("Profile photo URL found:", userData.profileUrl);
          setProfilePhoto(userData.profileUrl);
        } else {
          console.log("No profile photo URL found");
          setProfilePhoto(null);
        }

        if (userData.coverUrl) {
          console.log("Cover photo URL found:", userData.coverUrl);
          setCoverPhoto(userData.coverUrl);
        } else {
          console.log("No cover photo URL found");
          setCoverPhoto(null);
        }

        setNewEmail(user.email || "");
      } else {
        console.log("No user document found, creating new one");
        // Create a new user document if not exists
        try {
          await setDoc(doc(db, "users", user.uid), {
            username: user.displayName || "User",
            email: user.email,
            bio: "Tell us about yourself...",
            createdAt: new Date(),
          });
          setUsername(user.displayName || "User");
        } catch (error) {
          console.error("Error creating user document:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load user data");
    } finally {
      setFetchingData(false);
    }
  };

  const pickImage = async (
    setter: (uri: string) => void,
    type: "profile" | "cover"
  ) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to update your profile");
      return;
    }

    try {
      console.log(`Starting image picker for ${type} photo`);

      // Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need camera roll permission to change your photo"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === "profile" ? [1, 1] : [16, 9],
        quality: 0.2, // Lower quality for smaller file size
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        const localUri = result.assets[0].uri;
        console.log(`Image selected: ${localUri}`);

        try {
          // Get file info
          const filename = localUri.split("/").pop() || "image";
          console.log(`Filename: ${filename}`);

          // Determine MIME type based on file extension
          let fileType = "image/jpeg";
          if (filename.toLowerCase().endsWith(".png")) {
            fileType = "image/png";
          } else if (filename.toLowerCase().endsWith(".gif")) {
            fileType = "image/gif";
          } else if (filename.toLowerCase().endsWith(".webp")) {
            fileType = "image/webp";
          }

          console.log(`File type: ${fileType}`);

          // Create form data for upload
          const formData = new FormData();

          // Prepare the image object based on platform
          const imageObject =
            Platform.OS === "ios"
              ? {
                  uri: localUri,
                  type: fileType,
                  name: filename,
                }
              : {
                  uri: localUri,
                  type: fileType,
                  name: filename,
                };

          console.log("Adding image to form data:", imageObject);

          // @ts-ignore - TypeScript doesn't recognize append with file params
          formData.append("image", imageObject);

          const IMGBB_API_KEY = "";
          console.log("Uploading to ImgBB...");

          // Upload to ImgBB with additional error handling
          const response = await axios({
            method: "post",
            url: `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
            data: formData,
            headers: {
              "Content-Type": "multipart/form-data",
              Accept: "application/json",
            },
            timeout: 30000, // 30 second timeout
            maxContentLength: 10 * 1024 * 1024, // 10MB max
          });

          // Check response structure
          if (
            !response.data ||
            !response.data.data ||
            !response.data.data.display_url
          ) {
            console.error("Invalid ImgBB response:", response.data);
            throw new Error("Invalid response from image server");
          }

          // Get the hosted image URL that works across platforms
          const imageUrl = response.data.data.display_url;
          console.log(`Image uploaded successfully. URL: ${imageUrl}`);

          // Store the hosted URL in Firestore
          const userDocRef = doc(db, "users", user.uid);
          const updateField =
            type === "profile"
              ? { profileUrl: imageUrl }
              : { coverUrl: imageUrl };

          console.log(`Updating Firestore document with ${type} URL`);
          await updateDoc(userDocRef, updateField);

          // Update local state
          console.log(`Setting ${type} photo state`);
          setter(imageUrl);

          Alert.alert("Success", "Image updated successfully");
        } catch (error) {
          console.error("Error uploading image:", error);
          let errorMessage = "Failed to upload image";
          if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
          }

          // Show more detailed error for debugging
          if (axios.isAxiosError(error)) {
            if (error.response) {
              console.error("ImgBB response error:", error.response.data);
              errorMessage += ` (Status: ${error.response.status})`;
            } else if (error.request) {
              console.error("No response received:", error.request);
              errorMessage += " (No response from server)";
            }
          }

          Alert.alert("Error", errorMessage);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log("Image picker canceled or no image selected");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
      setIsLoading(false);
    }
  };

  const saveBio = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { bio });
      setEditing(false);
      Alert.alert("Success", "Bio updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update bio");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        onPress: async () => {
          try {
            await auth.signOut();
            // Navigate to welcome screen after successful sign out
            router.replace("/(auth)/welcome");
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  };

  const reportProblem = () => {
    Alert.alert(
      "Report a Problem",
      "Please describe the issue you're experiencing:",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: () =>
            Alert.alert("Thank you", "Your report has been submitted"),
        },
      ]
    );
  };

  // Account settings functionality
  const openAccountSettings = () => {
    if (user) {
      setNewEmail(user.email || "");
      setShowAccountSettings(true);
    }
  };

  const closeAccountSettings = () => {
    setShowAccountSettings(false);
    setCurrentPassword("");
    setNewEmail("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const updateUserEmail = async () => {
    if (!user || !currentPassword) {
      Alert.alert("Error", "Please enter your current password");
      return;
    }

    if (!newEmail) {
      Alert.alert("Error", "Please enter a new email");
      return;
    }

    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email || "",
        currentPassword
      );

      // Re-authenticate user
      await reauthenticateWithCredential(user, credential);

      // Update email in Firebase Auth
      await updateEmail(user, newEmail);

      // Update email in Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { email: newEmail });

      Alert.alert("Success", "Email updated successfully");
      setCurrentPassword("");
    } catch (error) {
      console.error("Error updating email:", error);

      let errorMessage = "Failed to update email. Please check your password.";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPassword = async () => {
    if (!user || !currentPassword) {
      Alert.alert("Error", "Please enter your current password");
      return;
    }

    if (!newPassword) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email || "",
        currentPassword
      );

      // Re-authenticate user
      await reauthenticateWithCredential(user, credential);

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);

      Alert.alert("Success", "Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);

      let errorMessage =
        "Failed to update password. Please check your current password.";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUsernameInSettings = async () => {
    if (!user || !username.trim()) {
      Alert.alert("Error", "Username cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { username });
      Alert.alert("Success", "Username updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update username");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.lightpink} />
        <Typo style={{ marginTop: 10 }}>Loading profile...</Typo>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          <Image
            source={
              coverPhoto
                ? { uri: coverPhoto }
                : require("@/assets/images/favicon.png")
            }
            style={styles.coverPhoto}
            resizeMode="cover"
            // Force reload to prevent caching issues
            key={coverPhoto || "default-cover"}
          />
          <TouchableOpacity
            style={styles.coverCameraButton}
            onPress={() => pickImage(setCoverPhoto, "cover")}
            disabled={isLoading}
          >
            <Ionicons name="camera" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Photo */}
        <View style={styles.profileSection}>
          <View style={styles.profilePhotoContainer}>
            <Image
              source={
                profilePhoto
                  ? { uri: profilePhoto }
                  : require("@/assets/images/favicon.png")
              }
              style={styles.profilePhoto}
              // Force reload to prevent caching issues
              key={profilePhoto || "default-profile"}
            />
            <TouchableOpacity
              style={styles.profileCameraButton}
              onPress={() => pickImage(setProfilePhoto, "profile")}
              disabled={isLoading}
            >
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Username display (no inline editing) */}
          <View style={styles.usernameContainer}>
            <Typo style={styles.username}>{username}</Typo>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioContainer}>
          {editing ? (
            <>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                style={styles.bioInput}
                placeholder="Tell us about yourself..."
              />
              <TouchableOpacity
                onPress={saveBio}
                style={styles.saveButton}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Typo style={styles.saveButtonText}>Save</Typo>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={styles.bioTextContainer}
              disabled={isLoading}
            >
              <Typo style={styles.bioText}>{bio || "Tap to add a bio."}</Typo>
              <Ionicons name="pencil" size={16} color={colors.lightpink} />
            </TouchableOpacity>
          )}
        </View>

        {/* About Us Section */}
        <View style={styles.sectionContainer}>
          <Typo style={styles.sectionTitle}>About Us</Typo>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <FontAwesome6 name="discord" size={22} color="#7289DA" />
              <Typo style={styles.menuItemText}>Discord</Typo>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="people" size={22} color={colors.lightpink} />
              <Typo style={styles.menuItemText}>Team</Typo>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.sectionContainer}>
          <Typo style={styles.sectionTitle}>Support</Typo>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={openAccountSettings}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={22} color="#0891B2" />
              <Typo style={styles.menuItemText}>Account Settings</Typo>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={reportProblem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="warning-outline" size={22} color="#F59E0B" />
              <Typo style={styles.menuItemText}>Report a Problem</Typo>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Typo style={styles.menuItemText}>Sign Out</Typo>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Debug info - remove in production */}
        {/*{__DEV__ && (
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              console.log("Profile URL:", profilePhoto);
              console.log("Cover URL:", coverPhoto);
              Alert.alert(
                "Debug Info",
                `Profile: ${profilePhoto || "none"}\nCover: ${
                  coverPhoto || "none"
                }`
              );
            }}
          >
            <Typo style={styles.debugText}>Debug Info</Typo>
          </TouchableOpacity>
        )}*/}
      </ScrollView>

      {/* Account Settings Modal */}
      <Modal
        visible={showAccountSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAccountSettings}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Typo style={styles.modalTitle}>Account Settings</Typo>
              <TouchableOpacity onPress={closeAccountSettings}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Username Section */}
              <View style={styles.settingsSection}>
                <Typo style={styles.settingsSectionTitle}>Username</Typo>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  style={styles.settingsInput}
                  placeholder="Enter username"
                  maxLength={20}
                />
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={updateUsernameInSettings}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Typo style={styles.updateButtonText}>Update Username</Typo>
                  )}
                </TouchableOpacity>
              </View>

              {/* Email Section */}
              <View style={styles.settingsSection}>
                <Typo style={styles.settingsSectionTitle}>Email Address</Typo>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  style={styles.settingsInput}
                  placeholder="Enter new email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={styles.settingsInput}
                  placeholder="Current password"
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={updateUserEmail}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Typo style={styles.updateButtonText}>Update Email</Typo>
                  )}
                </TouchableOpacity>
              </View>

              {/* Password Section */}
              <View style={styles.settingsSection}>
                <Typo style={styles.settingsSectionTitle}>Change Password</Typo>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={styles.settingsInput}
                  placeholder="Current password"
                  secureTextEntry
                />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={styles.settingsInput}
                  placeholder="New password"
                  secureTextEntry
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.settingsInput}
                  placeholder="Confirm new password"
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={updateUserPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Typo style={styles.updateButtonText}>Update Password</Typo>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.lightpink} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  coverContainer: {
    position: "relative",
    height: 180,
  },
  coverPhoto: {
    width: "100%",
    height: "100%",
  },
  coverCameraButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 20,
  },
  profileSection: {
    alignItems: "center",
    marginTop: -50,
  },
  profilePhotoContainer: {
    position: "relative",
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: "#fff",
  },
  profileCameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.lightpink,
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
  },
  usernameContainer: {
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  username: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Nunito_700Bold",
  },
  bioContainer: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  bioTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 8,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontFamily: "Nunito_400Regular",
    backgroundColor: "#fff",
  },
  bioText: {
    fontSize: 15,
    color: "#444",
    fontFamily: "Nunito_400Regular",
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.lightpink,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: "flex-end",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  sectionContainer: {
    marginTop: 30,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
    fontFamily: "Nunito_700Bold",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#374151",
    fontFamily: "Nunito_400Regular",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Nunito_700Bold",
  },
  modalContent: {
    maxHeight: "90%",
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    fontFamily: "Nunito_600SemiBold",
    color: "#374151",
  },
  settingsInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
  },
  updateButton: {
    backgroundColor: colors.lightpink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  updateButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  /*/ Debug styles
  debugButton: {
    backgroundColor: "#e0e0e0",
    padding: 8,
    marginHorizontal: 24,
    borderRadius: 4,
    alignItems: "center",
    marginBottom: 20,
  },
  debugText: {
    color: "#333",
    fontSize: 14,
  },*/
});
