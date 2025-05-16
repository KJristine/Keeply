import Typo from "@/components/Typo";
import { db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ImagePicker from 'react-native-image-crop-picker';

export default function Profile() {
  const { user, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const router = useRouter();
  const storage = getStorage();

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    setFetchingData(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUsername(userData.username || user.displayName || "User");
        setBio(userData.bio || "");
        setProfilePhoto(userData.profileUrl || null);
        setCoverPhoto(userData.coverUrl || null);
      } else {
        console.log("No user document found");
        // Create a new user document if not exists
        try {
          await setDoc(doc(db, "users", user.uid), {
            username: user.displayName || "User",
            email: user.email,
            bio: "Tell us about yourself...",
            createdAt: new Date(),
          });
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
      // Configure different options based on image type
      const options = {
        width: type === "profile" ? 500 : 1000,
        height: type === "profile" ? 500 : 560,
        cropping: true,
        cropperCircleOverlay: type === "profile", // Circular crop for profile pics
        mediaType: 'photo' as const,
        compressImageQuality: 0.8,
        compressImageMaxWidth: 1024,
        compressImageMaxHeight: 1024,
        includeBase64: false,
        cropperToolbarTitle: type === "profile" ? "Crop Profile Photo" : "Crop Cover Photo",
      };

      // Launch the image picker
      const image = await ImagePicker.openPicker(options);
      
      if (image) {
        setIsLoading(true);
        const localUri = image.path;
        
        try {
          // Convert URI to blob
          const response = await fetch(localUri);
          const blob = await response.blob();
          
          // Create a storage reference
          const storageRef = ref(
            storage, 
            `userImages/${user.uid}/${type}_${Date.now()}`
          );
          
          // Upload to Firebase Storage
          const uploadResult = await uploadBytes(storageRef, blob);
          
          // Get the download URL
          const downloadURL = await getDownloadURL(uploadResult.ref);
          
          // Update Firestore document with the cloud URL
          const userDocRef = doc(db, "users", user.uid);
          const updateField =
            type === "profile" ? { profileUrl: downloadURL } : { coverUrl: downloadURL };

          await updateDoc(userDocRef, updateField);

          // Update local state
          setter(downloadURL);

          console.log("Updated user document with cloud image URL");
          Alert.alert("Success", "Image updated successfully");
        } catch (error) {
          console.error("Error uploading image:", error);
          Alert.alert("Error", "Failed to upload image");
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error: unknown) {
      // Don't show error when user cancels
      if (error instanceof Error && error.message !== 'User cancelled image selection') {
        Alert.alert("Error", "Failed to pick image");
        console.error(error);
      }
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
            await logout();
            router.replace("/(auth)/welcome");
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
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
            />
            <TouchableOpacity
              style={styles.profileCameraButton}
              onPress={() => pickImage(setProfilePhoto, "profile")}
              disabled={isLoading}
            >
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Typo style={styles.username}>{username}</Typo>
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

          <TouchableOpacity style={styles.menuItem}>
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

        <View style={styles.versionContainer}>
          <Typo style={styles.versionText}>Keeply v1.0.0</Typo>
        </View>
      </ScrollView>

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
    backgroundColor: colors.usualBackground,
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
    borderColor: colors.usualBackground,
  },
  profileCameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.lightpink,
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.usualBackground,
  },
  username: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
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
    backgroundColor: colors.usualBackground,
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
  versionContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontFamily: "Nunito_400Regular",
  },
});