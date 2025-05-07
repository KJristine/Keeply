import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors } from "@/constants/theme";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const Welcome = () => {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenWrapper>
        <View style={styles.container}>
          {/* Sign In Link */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.signInWrapper}
            onPress={() => router.push('/(auth)/login')}
          >
            <Typo style={styles.signIn}>Sign In</Typo>
          </TouchableOpacity>

          {/* Illustration */}
          <Animated.Image
            entering={FadeIn.duration(1100)}
            source={require("@/assets/images/getstarted-illustration.jpg")}
            style={styles.image}
          />

          {/* Text Content */}
          <View style={styles.textContent}>
            <Animated.View
              entering={FadeInDown.duration(1100).springify().damping(13)}
              style={{ marginBottom: 10 }}
            >
              <Typo style={styles.title}>Let's Keep it Neatly!</Typo>
              <Typo style={styles.subtitle}>
                Keeply is designed to help you stay neat, organized, focused,
                and productive. Whether you’re managing work projects, personal
                errands, or long-term goals, this app will make sure you never
                miss a task again!
              </Typo>
            </Animated.View>
          </View>

          {/* CTA Button */}
          <Animated.View
            entering={FadeInDown.duration(1500)
              .delay(200)
              .springify()
              .damping(13)}
          >
            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.9}
              onPress={() => router.push("/(auth)/register")}
            >
              <Typo style={styles.buttonText}>Get Started</Typo>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScreenWrapper>
    </>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.usualBackground,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  signInWrapper: {
    position: "absolute",
    top: 30,
    right: 24,
  },
  signIn: {
    fontSize: 20,
    color: colors.textBlack,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  image: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.55,
    resizeMode: "cover",
    borderRadius: 16,
    marginBottom: 30,
  },
  textContent: {
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.inactiveButton,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#7B61FF",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  buttonText: {
    color: colors.textBlack,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Nunito_700Bold",
  },
});
