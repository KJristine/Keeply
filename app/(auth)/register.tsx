import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import Checkbox from "expo-checkbox";
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
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async () => {
    console.log("Submit button pressed");
    // Input validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Sign Up", "Please fill in all fields.");
      return;
    }

    if (!agree) {
      Alert.alert(
        "Sign Up",
        "You must agree to the Terms of Service and Privacy Policy."
      );
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Sign Up", "Please enter a valid email address.");
      return;
    }

    // Password validation (at least 6 characters)
    if (password.length < 6) {
      Alert.alert("Sign Up", "Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      // Use default profile URL
      const defaultProfileUrl =
        "https://ui-avatars.com/api/?name=" + encodeURIComponent(name);

      // Register using auth context
      await register(email, password, name, defaultProfileUrl);
      console.log("User registered successfully");
      // Navigation will be handled by AuthContext if configured correctly
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert(
        "Registration Error",
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
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
            source={require("@/assets/images/signup-illustration.png")}
            style={styles.image}
          />

          <Animated.View
            entering={FadeInDown.springify().damping(13)}
            style={styles.form}
          >
            <Typo style={styles.title}>SIGN UP</Typo>
            <Typo style={styles.subtitle}>Please enter your credentials</Typo>

            <TextInput
              placeholder="Username"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor="#6B7280"
              style={styles.input}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              editable={!isLoading}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#6B7280"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />

            <View style={styles.checkboxContainer}>
              <Checkbox
                value={agree}
                onValueChange={setAgree}
                color={agree ? "#7B61FF" : undefined}
                disabled={isLoading}
              />
              <Typo style={styles.checkboxLabel}>
                I agree to the Terms of Service and Privacy Policy
              </Typo>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                isLoading && styles.buttonDisabled, // Only apply disabled style when loading
              ]}
              activeOpacity={0.9}
              onPress={handleSubmit}
              disabled={isLoading} // Only disable when loading, not when checkbox isn't checked
            >
              {isLoading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Typo style={styles.buttonText}>Register</Typo>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/login")}
              style={styles.loginLink}
              disabled={isLoading}
            >
              <Typo style={styles.loginText}>
                Already have an account?{" "}
                <Typo style={styles.loginHighlight}>Sign In</Typo>
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
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    resizeMode: "contain",
    alignSelf: "center",
    marginTop: -60,
  },
  form: {
    width: "100%",
    marginTop: -30,
  },
  title: {
    fontSize: 40,
    color: "#1F2937",
    fontFamily: "Nunito_800ExtraBold",
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
    marginBottom: 24,
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
    marginBottom: 16,
    color: colors.textBlack,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Nunito_400Regular",
  },
  button: {
    backgroundColor: colors.inactiveButton,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
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
  loginLink: {
    marginTop: 8,
    alignItems: "center",
  },
  loginText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  loginHighlight: {
    color: colors.lightpink,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
  },
});
