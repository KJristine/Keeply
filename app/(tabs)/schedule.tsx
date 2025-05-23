import Typo from "@/components/Typo";
import { db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeListView } from "react-native-swipe-list-view";

interface Schedule {
  id?: string;
  subject: string;
  time: string;
  date: string;
  userId: string;
  createdAt: any;
}

export default function ScheduleScreen() {
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [time, setTime] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeDate, setTimeDate] = useState(new Date());
  const [modalOpacity] = useState(new Animated.Value(1));
  const [timePickerOpacity] = useState(new Animated.Value(0));
  const [modalVisibleBeforeTimePicker, setModalVisibleBeforeTimePicker] =
    useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );

  interface MarkedDates {
    [date: string]: {
      marked?: boolean;
      dotColor?: string;
      selected?: boolean;
    };
  }

  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const { user } = useAuth();

  const today = new Date();
  const dateString = `${today.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} - ${today.toLocaleDateString(undefined, { weekday: "long" })}`;

  //This will fetch schedules from the Firestore Database
  const fetchSchedules = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const schedulesRef = collection(db, "schedules");
      const q = query(schedulesRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);

      const schedulesData: Schedule[] = [];
      const dates: {
        [key: string]: { marked: boolean; dotColor: string; selected: boolean };
      } = {};

      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Schedule;
        schedulesData.push(data);

        //This will mark dates on calendar, the pink circle ones
        if (data.date) {
          dates[data.date] = {
            marked: true,
            dotColor: colors.lightpink,
            selected: selectedDate === data.date,
          };
        }
      });

      setSchedules(schedulesData);
      setMarkedDates(dates);
    } catch (error) {
      console.error("Error fetching schedules:", error);
      Alert.alert("Error", "Failed to load schedules");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [user]);

  useEffect(() => {
    if (user) {
      updateSelectedDateMarking();
    }
  }, [selectedDate]);

  const updateSelectedDateMarking = () => {
    if (!selectedDate) return;

    const updatedMarkedDates = { ...markedDates };

    // Reset selection status for all dates
    Object.keys(updatedMarkedDates).forEach((date) => {
      updatedMarkedDates[date] = {
        ...updatedMarkedDates[date],
        selected: date === selectedDate,
      };
    });

    // If selected date isn't already marked, add it
    if (!updatedMarkedDates[selectedDate]) {
      updatedMarkedDates[selectedDate] = {
        selected: true,
      };
    } else {
      updatedMarkedDates[selectedDate].selected = true;
    }

    setMarkedDates(updatedMarkedDates);
  };

  const handleCreateSchedule = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to create schedules");
      return;
    }

    if (!subject.trim() || !time.trim() || !selectedDate) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const scheduleData = {
        subject: subject.trim(),
        time: time.trim(),
        date: selectedDate,
        userId: user.uid,
        ...(editingScheduleId ? {} : { createdAt: serverTimestamp() }),
      };

      if (editingScheduleId) {
        // Update existing schedule
        await updateDoc(doc(db, "schedules", editingScheduleId), scheduleData);
        Alert.alert("Success", "Schedule updated successfully!");
      } else {
        // Create new schedule
        await addDoc(collection(db, "schedules"), scheduleData);
        Alert.alert("Success", "Schedule added successfully!");
      }

      handleCloseModal();
      resetForm();
      setEditingScheduleId(null);
      fetchSchedules(); // Refresh schedules
    } catch (error) {
      console.error("Error with schedule:", error);
      Alert.alert(
        "Error",
        `Failed to ${editingScheduleId ? "update" : "create"} schedule`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!scheduleId) return;

    Alert.alert(
      "Delete Schedule",
      "Are you sure you want to delete this schedule?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);

              // Silence warnings during this operation
              const originalConsoleWarn = console.warn;
              console.warn = (message) => {
                if (
                  message &&
                  (message.includes("BloomFilter") ||
                    (typeof message === "object" &&
                      message.name === "BloomFilterError"))
                ) {
                  // Ignore BloomFilter warnings
                  return;
                }
                originalConsoleWarn(message);
              };

              // Perform the delete operation
              await deleteDoc(doc(db, "schedules", scheduleId));

              // Restore original console.warn
              console.warn = originalConsoleWarn;

              Alert.alert("Success", "Schedule deleted successfully!");
              fetchSchedules(); // Refresh the list
            } catch (error) {
              console.error("Error deleting schedule:", error);
              Alert.alert("Error", "Failed to delete schedule");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEditSchedule = (schedule: Schedule) => {
    if (!schedule.id) return;

    // Set state with schedule data to edit
    setSubject(schedule.subject);
    setTime(schedule.time);
    setSelectedDate(schedule.date);

    // Store the ID of the schedule being edited
    setEditingScheduleId(schedule.id);

    // Open the modal for editing
    handleOpenModal();
  };

  const resetForm = () => {
    setSubject("");
    setTime("");
  };

  const onDayPress = (day: DateData) => {
    const formattedDate = day.dateString;
    setSelectedDate(formattedDate);
  };

  const getSchedulesForSelectedDate = () => {
    if (!selectedDate) return [];
    return schedules.filter((schedule) => schedule.date === selectedDate);
  };

  // Smooth transition animations
  const fadeOutModal = (callback: () => void) => {
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      callback();
      fadeInTimePicker();
    });
  };

  const fadeInModal = () => {
    Animated.timing(modalOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const fadeInTimePicker = () => {
    Animated.timing(timePickerOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const fadeOutTimePicker = (callback: () => void) => {
    Animated.timing(timePickerOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      callback();
      fadeInModal();
    });
  };

  // Show time picker with fade transition
  const showTimePickerHandler = () => {
    setModalVisibleBeforeTimePicker(true);
    fadeOutModal(() => {
      setShowTimePicker(true);
    });
  };

  // Cancel time picker with fade transition
  const cancelTimePicker = () => {
    fadeOutTimePicker(() => {
      setShowTimePicker(false);
      if (Platform.OS === "ios" && modalVisibleBeforeTimePicker) {
        // Do nothing special as modal fades in
      }
    });
  };

  // Confirm time picker with fade transition
  const confirmTime = () => {
    try {
      const formattedTime = timeDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setTime(formattedTime);
    } catch (error) {
      console.error("Error formatting time:", error);
    }
    fadeOutTimePicker(() => {
      setShowTimePicker(false);
      if (Platform.OS === "ios" && modalVisibleBeforeTimePicker) {
        // Do nothing special as modal fades in
      }
    });
  };

  // Handle time change event
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      if (event.type === "set" && selectedDate) {
        setTimeDate(selectedDate);
        try {
          const formattedTime = selectedDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          setTime(formattedTime);
        } catch (error) {
          console.error("Error formatting time:", error);
        }
      }
      setShowTimePicker(false);
      fadeInModal();
    } else if (selectedDate) {
      setTimeDate(selectedDate);
    }
  };

  const handleCloseModal = () => {
    // Animate the modal fading out
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 150, // Fast but smooth fade out
      useNativeDriver: true,
    }).start(() => {
      // Only hide the modal after animation completes
      setShowModal(false);
      setShowTimePicker(false);
      resetForm();
      setEditingScheduleId(null);
      // Don't reset opacity here - it should be reset only when opening the modal
    });
  };

  const handleOpenModal = () => {
    // Reset opacity to 0 before showing the modal
    modalOpacity.setValue(0);

    // First set modal to visible
    setShowModal(true);

    // Then animate it fading in
    Animated.timing(modalOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Typo style={styles.brand}>keeply.</Typo>
          <Typo style={styles.headerText}>Schedule</Typo>
          <Typo style={styles.dateText}>{dateString}</Typo>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={onDayPress}
            markedDates={markedDates}
            theme={{
              backgroundColor: "#ffffff",
              calendarBackground: "#ffffff",
              textSectionTitleColor: "#b6c1cd",
              selectedDayBackgroundColor: colors.lightpink,
              selectedDayTextColor: "#ffffff",
              todayTextColor: colors.lightpink,
              dayTextColor: "#2d4150",
              textDisabledColor: "#d9e1e8",
              dotColor: colors.lightpink,
              selectedDotColor: "#ffffff",
              arrowColor: colors.lightpink,
              monthTextColor: "#2d4150",
              indicatorColor: colors.lightpink,
              textDayFontFamily: "Nunito_400Regular",
              textMonthFontFamily: "Nunito_700Bold",
              textDayHeaderFontFamily: "Nunito_600SemiBold",
              textDayFontSize: 16,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 14,
            }}
          />
        </View>

        {/* Schedule List Container */}
        <View style={[styles.scheduleListContainer, { flex: 1 }]}>
          <Typo style={styles.scheduleListTitle}>
            {selectedDate
              ? `Schedules for ${new Date(selectedDate).toLocaleDateString(
                  undefined,
                  { month: "long", day: "numeric", year: "numeric" }
                )} - ${new Date(selectedDate).toLocaleDateString(undefined, {
                  weekday: "long",
                })}`
              : "Select a date to view schedules"}
          </Typo>

          {isLoading ? (
            <ActivityIndicator color={colors.lightpink} style={styles.loader} />
          ) : (
            <>
              {getSchedulesForSelectedDate().length > 0 ? (
                <SwipeListView
                  data={getSchedulesForSelectedDate()}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={({ item: schedule }) => (
                    <View style={styles.scheduleItem}>
                      <View style={styles.scheduleTimeContainer}>
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={colors.lightpink}
                        />
                        <Typo style={styles.scheduleTime}>{schedule.time}</Typo>
                      </View>
                      <Typo style={styles.scheduleSubject}>
                        {schedule.subject}
                      </Typo>
                    </View>
                  )}
                  renderHiddenItem={({ item: schedule }) => (
                    <View style={styles.rowBack}>
                      <TouchableOpacity
                        style={[styles.backRightBtn, styles.backRightBtnEdit]}
                        onPress={() => handleEditSchedule(schedule)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={24}
                          color="#fff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.backRightBtn, styles.backRightBtnDelete]}
                        onPress={() => handleDeleteSchedule(schedule.id || "")}
                      >
                        <Ionicons name="trash-outline" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  rightOpenValue={-150}
                  disableRightSwipe
                />
              ) : (
                selectedDate && (
                  <View style={styles.emptyScheduleContainer}>
                    <Image
                      source={require("@/assets/images/schedule.png")}
                      style={styles.emptyScheduleImage}
                      resizeMode="contain"
                    />
                    <Typo style={styles.emptyScheduleText}>
                      No schedules for this date
                    </Typo>
                  </View>
                )
              )}
            </>
          )}
        </View>
      </View>

      {/* Add Schedule Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleOpenModal}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Schedule Modal with animated opacity */}
      <Modal
        visible={showModal && !showTimePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCloseModal}
        statusBarTranslucent={true}
      >
        <Animated.View
          style={[styles.modalBackdrop, { opacity: modalOpacity }]}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseModal}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Typo style={styles.modalTitle}>
              {editingScheduleId ? "Edit Schedule" : "New Schedule"}
            </Typo>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Subject */}
              <Typo style={styles.inputLabel}>Subject Title</Typo>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="book-outline"
                  size={22}
                  color={colors.lightpink}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Enter subject"
                  value={subject}
                  onChangeText={setSubject}
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Date */}
              <Typo style={styles.inputLabel}>Select Date</Typo>
              <View style={styles.datePickerContainer}>
                <Calendar
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  markedDates={{
                    [selectedDate]: {
                      selected: true,
                      selectedColor: colors.lightpink,
                    },
                  }}
                  style={styles.miniCalendar}
                  theme={{
                    backgroundColor: "#ffffff",
                    calendarBackground: "#ffffff",
                    textSectionTitleColor: "#b6c1cd",
                    selectedDayBackgroundColor: colors.lightpink,
                    selectedDayTextColor: "#ffffff",
                    todayTextColor: colors.lightpink,
                    dayTextColor: "#2d4150",
                    arrowColor: colors.lightpink,
                  }}
                />
              </View>

              {/* Time */}
              <Typo style={styles.inputLabel}>Time</Typo>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={showTimePickerHandler}
              >
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={colors.lightpink}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={time}
                  placeholder="Select time"
                  style={styles.input}
                  placeholderTextColor="#9CA3AF"
                  editable={false}
                  pointerEvents="none"
                />
                <Ionicons
                  name="chevron-down-outline"
                  size={20}
                  color="#9CA3AF"
                  style={{ marginRight: 10 }}
                />
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!subject.trim() || !time.trim() || !selectedDate) &&
                    styles.confirmButtonDisabled,
                ]}
                onPress={handleCreateSchedule}
                disabled={
                  isLoading || !subject.trim() || !time.trim() || !selectedDate
                }
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Typo style={styles.confirmButtonText}>
                    {editingScheduleId ? "Update Schedule" : "Add Schedule"}
                  </Typo>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Animated.View>
      </Modal>

      {/* Time picker modal with opacity animation */}
      {Platform.OS === "ios" && showTimePicker && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={true}
          statusBarTranslucent={true}
        >
          <Animated.View
            style={[styles.timePickerBackdrop, { opacity: timePickerOpacity }]}
          >
            <View style={styles.timePickerContainer}>
              <View style={styles.timePickerHeader}>
                <Typo style={styles.timePickerTitle}>Select Time</Typo>
              </View>

              <DateTimePicker
                testID="iosTimePicker"
                value={timeDate}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={styles.timePicker}
                textColor="black"
              />

              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={cancelTimePicker}
                >
                  <Typo style={styles.timePickerCancel}>Cancel</Typo>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timePickerButton,
                    styles.timePickerConfirmButton,
                  ]}
                  onPress={confirmTime}
                >
                  <Typo style={styles.timePickerConfirm}>Confirm</Typo>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Modal>
      )}

      {/* Android native time picker */}
      {Platform.OS === "android" && showTimePicker && (
        <DateTimePicker
          testID="androidTimePicker"
          value={timeDate}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
          themeVariant="light"
        />
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
  header: {
    padding: 16,
  },
  brand: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.textBlack,
    fontFamily: "Nunito_700Bold",
  },
  headerText: {
    fontSize: 45,
    fontWeight: "800",
    marginTop: 20,
    marginLeft: 5,
    color: "#1F2937",
    fontFamily: "Nunito_800ExtraBold",
  },
  dateText: {
    fontSize: 17,
    color: "#4B5563",
    marginLeft: 5,
    textTransform: "uppercase",
    fontFamily: "Nunito_400Regular",
  },
  dayText: {
    fontSize: 16,
    color: "#6B7280",
    fontFamily: "Nunito_400Regular",
  },
  calendarContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginHorizontal: 16,
  },
  scheduleListContainer: {
    marginTop: 20,
    padding: 16,
  },
  scheduleListTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#4B5563",
    fontFamily: "Nunito_700Bold",
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scheduleTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleTime: {
    fontSize: 15,
    color: "#4B5563",
    marginLeft: 8,
    fontFamily: "Nunito_600SemiBold",
  },
  scheduleSubject: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    fontFamily: "Nunito_600SemiBold",
  },
  emptyScheduleContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyScheduleImage: {
    width: 150,
    height: 150,
    marginBottom: 10,
  },
  emptyScheduleText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  addButton: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lightpink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1,
  },
  loader: {
    marginVertical: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "stretch",
    maxHeight: "90%",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 15,
    padding: 8,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 20,
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
    textAlign: "center",
  },
  illustration: {
    width: "100%",
    height: 130,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#4B5563",
    fontFamily: "Nunito_600SemiBold",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  inputIcon: {
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: "#374151",
    fontFamily: "Nunito_400Regular",
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  miniCalendar: {
    height: 300,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  confirmButton: {
    backgroundColor: colors.lightpink,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: "#F3ABAB",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  // Time picker modal styles
  timePickerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  timePickerContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  timePicker: {
    width: "100%",
    height: 180,
    color: "#000000",
  },
  timePickerHeader: {
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
  },
  timePickerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
  },
  timePickerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 15,
  },
  timePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 120,
    alignItems: "center",
  },
  timePickerConfirmButton: {
    backgroundColor: colors.lightpink,
  },
  timePickerCancel: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  timePickerConfirm: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  // SwipeListView styles
  rowBack: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: 15,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  backRightBtn: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 75,
    height: "100%",
  },
  backRightBtnEdit: {
    backgroundColor: "#4b7bec",
    right: 75,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  backRightBtnDelete: {
    backgroundColor: "#ff4d4f",
    right: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
});
