import Typo from "@/components/Typo";
import { db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddTask() {
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to create tasks");
      return;
    }

    setIsLoading(true);
    try {
      // Create a new task document in Firestore
      const taskData = {
        title: title.trim(),
        completed: false,
        userId: user.uid,
        createdAt: serverTimestamp(),
      };

      // Add the document to the tasks collection
      await addDoc(collection(db, "tasks"), taskData);

      // Success message
      Alert.alert("Success", "Task created successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Navigate to home screen after user acknowledges
            router.replace("/(tabs)/home");
          },
        },
      ]);

      // Clear the input
      setTitle("");
    } catch (error) {
      console.error("Error creating task:", error);
      Alert.alert("Error", "Failed to create task. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandText}>keeply.</Text>
        </View>

        {/* Main Content - Non-Scrollable */}
        <View style={styles.content}>
          <Typo style={styles.heading}>Add Task</Typo>

          <Image
            source={require("../../assets/images/taskllist.png")}
            style={styles.image}
            resizeMode="contain"
          />

          <View style={styles.formGroup}>
            <Typo style={styles.inputLabel}>To-do</Typo>
            <View style={styles.inputContainer}>
              <View style={styles.iconContainer}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color={colors.lightpink}
                />
              </View>
              <TextInput
                placeholder="What would you like to do?"
                value={title}
                onChangeText={setTitle}
                style={styles.input}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Floating Action Button */}
        <TouchableOpacity
          onPress={handleCreate}
          style={[
            styles.floatingButton,
            (isLoading || !title.trim()) && styles.floatingButtonDisabled,
          ]}
          activeOpacity={0.8}
          disabled={isLoading || !title.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Typo style={styles.createText}>Create Task</Typo>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  header: {
    padding: 16,
  },
  brandText: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.textBlack,
    fontFamily: "Nunito_700Bold",
  },
  titleContainer: {
    marginBottom: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 45,
    fontWeight: "800",
    marginBottom: 0,
    fontFamily: "Nunito_800ExtraBold",
    color: "#1F2937",
    marginLeft: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  heading: {
    fontSize: 45,
    fontWeight: "800",
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
    marginBottom: 20,
    alignSelf: "center",
  },
  image: {
    width: "80%",
    height: 200,
    marginVertical: 16,
    marginBottom: 32,
  },
  formGroup: {
    width: "100%",
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
    fontFamily: "Nunito_600SemiBold",
    alignSelf: "flex-start",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    paddingRight: 8,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#374151",
    fontFamily: "Nunito_400Regular",
  },
  floatingButton: {
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
    backgroundColor: colors.lightpink,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  floatingButtonDisabled: {
    backgroundColor: "#F3ABAB", // Lighter pink for disabled state
  },
  createText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
});
