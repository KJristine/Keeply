import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async () => {
    // Basic validation
    if (!email.trim() || !password.trim()) {
      Alert.alert("Login", "Please fill in all fields.");
      return;
    }

    // Set loading state
    setIsLoading(true);

    try {
      console.log("Attempting login with:", email);

      // Use the login function from auth context
      const result = await login(email, password);

      if (result.success) {
        console.log("Login successful");
        // Navigate to the home screen
        router.replace("/(tabs)/home");
      } else {
        // Display the error message from the login function
        Alert.alert("Login Failed", result.msg || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert(
        "Login Error",
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // You can implement password reset functionality here
    Alert.alert("Forgot Password", "This feature will be implemented soon.");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenWrapper statusBarStyle="dark-content" backgroundColor="white">
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Illustration */}
          <Animated.Image
            entering={FadeIn.duration(1100)}
            source={require("@/assets/images/notebook.png")}
            style={styles.image}
          />

          <Animated.View
            entering={FadeInDown.springify().damping(13)}
            style={styles.form}
          >
            <Typo style={styles.title}>keeply.</Typo>
            <Typo style={styles.subtitle}>
              Welcome back! Please login to continue.
            </Typo>

            <TextInput
              placeholder="keeply@example.com"
              placeholderTextColor="#4B5563"
              style={styles.input}
              keyboardType="email-address"
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
              editable={!isLoading}
            />
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor="#4B5563"
              style={styles.input}
              secureTextEntry
              onChangeText={setPassword}
              value={password}
              editable={!isLoading}
            />

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotWrapper}
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              <Typo style={styles.forgotText}>Forgot Password?</Typo>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Typo style={styles.buttonText}>Login</Typo>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register")}
              style={styles.signupLink}
              disabled={isLoading}
            >
              <Typo style={styles.signupText}>
                Don't have an account?{" "}
                <Typo style={styles.signupHighlight}>Sign Up</Typo>
              </Typo>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </ScreenWrapper>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.usualBackground,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  image: {
    marginTop: -80,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.85,
    resizeMode: "contain",
  },
  form: {
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: 56,
    fontWeight: "800",
    color: "#1F2937",
    fontFamily: "Nunito_800ExtraBold",
    textAlign: "center",
    marginTop: -60,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderColor: "#000000",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
    marginBottom: 14,
    color: colors.textBlack,
  },
  forgotWrapper: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 14,
    color: colors.textBlack,
    fontFamily: "Nunito_600SemiBold",
  },
  button: {
    backgroundColor: colors.inactiveButton,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: colors.inactiveButton,
    opacity: 0.7,
  },
  buttonText: {
    color: colors.textBlack,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Nunito_700Bold",
  },
  signupLink: {
    marginTop: 4,
  },
  signupText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  signupHighlight: {
    color: colors.lightpink,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
  },
});
