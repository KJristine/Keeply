import Typo from "@/components/Typo";
import { db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeListView } from "react-native-swipe-list-view";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  userId: string;
  createdAt: any;
}

const POMODORO_MINUTES = 25;

const Home = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();

  // Streak state
  const [streak, setStreak] = useState(0);

  // Pomodoro timer state
  const [pomodoroTime, setPomodoroTime] = useState(POMODORO_MINUTES * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showPomodoroModal, setShowPomodoroModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit task state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentEditTask, setCurrentEditTask] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

  // Calculate completion percentage
  const completedTasks = tasks.filter((task) => task.completed).length;
  const totalTasks = tasks.length;
  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Get weekly data
  const getTasksForWeekday = (day: number) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Adjust to make Monday = 0
    const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1;
    const adjustedTargetDay = day === 6 ? 0 : day + 1;

    // Calculate days difference
    let daysDiff = adjustedTargetDay - adjustedCurrentDay;
    if (daysDiff > 0) {
      daysDiff -= 7; // If day is in future, get last week's day
    }

    const targetDate = new Date();
    targetDate.setDate(today.getDate() + daysDiff);

    // Count tasks for that date
    return tasks.filter((task) => {
      if (!task.createdAt) return false;

      const taskDate = task.createdAt.toDate
        ? task.createdAt.toDate()
        : new Date(task.createdAt);

      return (
        taskDate.getDate() === targetDate.getDate() &&
        taskDate.getMonth() === targetDate.getMonth() &&
        taskDate.getFullYear() === targetDate.getFullYear()
      );
    }).length;
  };

  // Format timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Start or resume timer
  const startTimer = () => {
    if (timerRef.current) return;

    setIsTimerRunning(true);
    timerRef.current = setInterval(() => {
      setPomodoroTime((prev) => {
        if (prev <= 1) {
          // Timer complete
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          timerRef.current = null;
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Pause timer
  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsTimerRunning(false);
    }
  };

  // Reset timer
  const resetTimer = () => {
    pauseTimer();
    setPomodoroTime(POMODORO_MINUTES * 60);
  };

  // Delete task
  const deleteTask = async (taskId: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "tasks", taskId));
            // Update local state
            setTasks(tasks.filter((task) => task.id !== taskId));
          } catch (error) {
            console.error("Error deleting task:", error);
            Alert.alert("Error", "Failed to delete task");
          }
        },
        style: "destructive",
      },
    ]);
  };

  // Edit task
  const editTask = (taskId: string, currentTitle: string) => {
    setCurrentEditTask({ id: taskId, title: currentTitle });
    setEditedTitle(currentTitle);
    setEditModalVisible(true);
  };

  // Handle edit submission
  const handleEditSubmit = async () => {
    if (!currentEditTask || !editedTitle.trim()) {
      setEditModalVisible(false);
      return;
    }

    try {
      await updateDoc(doc(db, "tasks", currentEditTask.id), {
        title: editedTitle.trim(),
      });

      // Update local state
      setTasks(
        tasks.map((task) =>
          task.id === currentEditTask.id
            ? { ...task, title: editedTitle.trim() }
            : task
        )
      );

      setEditModalVisible(false);
    } catch (error) {
      console.error("Error updating task:", error);
      Alert.alert("Error", "Failed to update task");
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const tasksRef = collection(db, "tasks");
      // Modified query to avoid using orderBy which requires an index
      const q = query(tasksRef, where("userId", "==", user.uid));

      const querySnapshot = await getDocs(q);
      const tasksList: Task[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        tasksList.push({
          id: doc.id,
          title: data.title,
          completed: data.completed,
          userId: data.userId,
          createdAt: data.createdAt,
        });
      });

      // Sort in memory instead of using orderBy in the query
      tasksList.sort((a, b) => {
        const dateA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : typeof a.createdAt === "number"
          ? a.createdAt
          : 0;
        const dateB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : typeof b.createdAt === "number"
          ? b.createdAt
          : 0;
        return dateB - dateA; // descending order
      });

      setTasks(tasksList);

      // Calculate streak based on completed tasks
      calculateStreak(tasksList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate user's streak
  const calculateStreak = (tasksList: Task[]) => {
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's a completed task today
    const hasCompletedTaskToday = tasksList.some((task) => {
      if (!task.completed || !task.createdAt) return false;

      const taskDate = task.createdAt.toDate
        ? task.createdAt.toDate()
        : new Date(task.createdAt);

      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === today.getTime();
    });

    if (hasCompletedTaskToday) {
      currentStreak = 1;

      // Check previous days
      let checkDate = new Date(today);
      let keepChecking = true;

      while (keepChecking) {
        checkDate.setDate(checkDate.getDate() - 1);

        const hasCompletedTask = tasksList.some((task) => {
          if (!task.completed || !task.createdAt) return false;

          const taskDate = task.createdAt.toDate
            ? task.createdAt.toDate()
            : new Date(task.createdAt);

          taskDate.setHours(0, 0, 0, 0);
          return taskDate.getTime() === checkDate.getTime();
        });

        if (hasCompletedTask) {
          currentStreak++;
        } else {
          keepChecking = false;
        }
      }
    }

    setStreak(currentStreak);
  };

  // Fetch tasks when the component mounts
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Refresh tasks when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const toggleTaskCompletion = async (taskId: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        completed: !completed,
      });

      // Update local state
      setTasks(
        tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !completed } : task
        )
      );

      // Recalculate streak if a task was completed
      if (!completed) {
        calculateStreak(
          tasks.map((task) =>
            task.id === taskId ? { ...task, completed: true } : task
          )
        );
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const getFilteredTasks = () => {
    // First filter by tab selection
    let filteredByTab = tasks;
    switch (activeTab) {
      case "todos":
        filteredByTab = tasks;
        break;
      case "ongoing":
        filteredByTab = tasks.filter((task) => !task.completed);
        break;
      case "completed":
        filteredByTab = tasks.filter((task) => task.completed);
        break;
    }

    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      return filteredByTab.filter((task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filteredByTab;
  };

  // Function to get active tab background color
  const getActiveTabStyle = (tab: "todos" | "ongoing" | "completed") => {
    if (tab === activeTab) {
      switch (tab) {
        case "todos":
          return { backgroundColor: "#3B82F6" }; // Blue
        case "ongoing":
          return { backgroundColor: "#EF4444" }; // Red
        case "completed":
          return { backgroundColor: "#10B981" }; // Green
        default:
          return { backgroundColor: "#FFF" };
      }
    }
    return null;
  };

  // Function to get active tab text color
  const getActiveTabTextStyle = (tab: "todos" | "ongoing" | "completed") => {
    if (tab === activeTab) {
      return { color: "#FFFFFF", fontFamily: "Nunito_700Bold" };
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandText}>keeply.</Text>
      </View>

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Tasks</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#EF4444" />
          <Text style={styles.statNumber}>
            {tasks.filter((t) => !t.completed).length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-done-outline" size={24} color="#10B981" />
          <Text style={styles.statNumber}>{completedTasks}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Streak & Timer Controls */}
      <View style={styles.toolsContainer}>
        {/* Streak Display */}
        <View style={styles.streakContainer}>
          <Ionicons name="flame" size={24} color="#FF7F50" />
          <Text style={styles.streakText}>
            {streak === 0
              ? "Start your streak today!"
              : `${streak} day streak!`}
          </Text>
        </View>

        {/* Pomodoro Button */}
        <TouchableOpacity
          style={styles.pomodoroButton}
          onPress={() => setShowPomodoroModal(true)}
        >
          <Ionicons name="timer-outline" size={20} color="#FFFFFF" />
          <Text style={styles.pomodoroButtonText}>Focus Timer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, getActiveTabStyle("todos")]}
            onPress={() => setActiveTab("todos")}
          >
            <Text style={[styles.tabText, getActiveTabTextStyle("todos")]}>
              To Do list
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, getActiveTabStyle("ongoing")]}
            onPress={() => setActiveTab("ongoing")}
          >
            <Text style={[styles.tabText, getActiveTabTextStyle("ongoing")]}>
              Ongoing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, getActiveTabStyle("completed")]}
            onPress={() => setActiveTab("completed")}
          >
            <Text style={[styles.tabText, getActiveTabTextStyle("completed")]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[styles.progressBar, { width: `${completionPercentage}%` }]}
          >
            <Text style={styles.progressText}>{completionPercentage}%</Text>
          </View>
        </View>

        {/* Task List with Swipe Functionality */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.lightpink} />
            <Typo style={styles.loaderText}>Loading tasks...</Typo>
          </View>
        ) : (
          <SwipeListView
            data={getFilteredTasks()}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskListContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.taskItem,
                  item.completed ? styles.completedTask : styles.incompleteTask,
                ]}
                onPress={() => toggleTaskCompletion(item.id, item.completed)}
                activeOpacity={0.8}
              >
                <Text style={styles.taskText}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => toggleTaskCompletion(item.id, item.completed)}
                >
                  {item.completed ? (
                    <View style={styles.checkbox}>
                      <Ionicons
                        name="checkmark-outline"
                        size={18}
                        color="#fff"
                      />
                    </View>
                  ) : (
                    <View style={styles.checkboxEmpty} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            renderHiddenItem={({ item }) => (
              <View style={styles.rowBack}>
                <TouchableOpacity
                  style={[styles.backRightBtn, styles.backRightBtnLeft]}
                  onPress={() => editTask(item.id, item.title)}
                >
                  <Ionicons name="create-outline" size={24} color="#fff" />
                  <Text style={styles.backTextWhite}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.backRightBtn, styles.backRightBtnRight]}
                  onPress={() => deleteTask(item.id)}
                >
                  <Ionicons name="trash-outline" size={24} color="#fff" />
                  <Text style={styles.backTextWhite}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            rightOpenValue={-160} // Width of the actions container
            stopRightSwipe={-160}
            disableRightSwipe
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Image
                  source={require("@/assets/images/taskllist.png")}
                  style={styles.emptyStateImage}
                  resizeMode="contain"
                />
                <Text style={styles.emptyText}>
                  {activeTab === "completed"
                    ? "No completed tasks yet"
                    : activeTab === "ongoing"
                    ? "No ongoing tasks"
                    : searchQuery
                    ? "No matching tasks found"
                    : "No tasks yet. Create your first task!"}
                </Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Pomodoro Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPomodoroModal}
        onRequestClose={() => setShowPomodoroModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pomodoroModalContainer}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowPomodoroModal(false)}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>

            <Text style={styles.pomodoroTitle}>Focus Timer</Text>
            <Text style={styles.pomodoroTimeDisplay}>
              {formatTime(pomodoroTime)}
            </Text>

            <View style={styles.pomodoroControls}>
              {isTimerRunning ? (
                <TouchableOpacity
                  style={[styles.pomodoroControlButton, styles.pauseButton]}
                  onPress={pauseTimer}
                >
                  <Ionicons name="pause" size={24} color="#FFFFFF" />
                  <Text style={styles.controlButtonText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.pomodoroControlButton, styles.startButton]}
                  onPress={startTimer}
                  disabled={pomodoroTime === 0}
                >
                  <Ionicons name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.controlButtonText}>Start</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.pomodoroControlButton, styles.resetButton]}
                onPress={resetTimer}
              >
                <Ionicons name="refresh" size={24} color="#FFFFFF" />
                <Text style={styles.controlButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.pomodoroTip}>
              Work focused for 25 minutes, then take a short break.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <Text style={styles.editModalTitle}>Edit Task</Text>
            <TextInput
              style={styles.editInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              autoFocus
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.updateButton]}
                onPress={handleEditSubmit}
              >
                <Text style={styles.updateButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;

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
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 45,
    fontWeight: "800",
    marginBottom: 0,
    fontFamily: "Nunito_800ExtraBold",
    color: "#1F2937",
    marginLeft: 5,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "30%",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    color: "#1F2937",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: "#6B7280",
    marginTop: 4,
  },
  // Styles for streak display and pomodoro button
  toolsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9F0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  streakText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: "#FF7F50",
    marginLeft: 6,
  },
  pomodoroButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightpink,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  pomodoroButtonText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  // Search bar styles
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    color: "#1F2937",
    marginLeft: 8,
    padding: 0,
  },
  // Pomodoro modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pomodoroModalContainer: {
    width: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  closeModalButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  pomodoroTitle: {
    fontSize: 22,
    fontFamily: "Nunito_700Bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  pomodoroTimeDisplay: {
    fontSize: 48,
    fontFamily: "Nunito_700Bold",
    color: "#1F2937",
    marginBottom: 24,
  },
  pomodoroControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  pomodoroControlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 110,
    justifyContent: "center",
  },
  startButton: {
    backgroundColor: "#10B981",
  },
  pauseButton: {
    backgroundColor: "#F59E0B",
  },
  resetButton: {
    backgroundColor: "#6B7280",
  },
  controlButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  pomodoroTip: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  contentContainer: {
    paddingHorizontal: 16,
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    marginVertical: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 0,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "#FFF",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
  },
  progressBarContainer: {
    height: 36,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 0,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.lightpink,
    borderRadius: 18,
    justifyContent: "center",
    minWidth: 40,
    borderWidth: 0,
  },
  progressText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    marginLeft: 12,
  },
  taskListContainer: {
    paddingVertical: 10,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    backgroundColor: "#FFF", // Ensure background is set
  },
  completedTask: {
    backgroundColor: "#ECFDF5",
  },
  incompleteTask: {
    backgroundColor: "#FEF2F2",
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
    color: "#1F2937",
    paddingRight: 8,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    backgroundColor: "#FFF",
  },
  // Swipe list styles
  rowBack: {
    alignItems: "center",
    backgroundColor: "#DDD",
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: 15,
    margin: 0,
    marginBottom: 12,
    borderRadius: 12,
    height: 65, // Match your task item height
  },
  backRightBtn: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 80,
    paddingHorizontal: 6,
  },
  backRightBtnLeft: {
    backgroundColor: "#3B82F6", // Blue for edit
    right: 80,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  backRightBtnRight: {
    backgroundColor: "#EF4444", // Red for delete
    right: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  backTextWhite: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 4,
  },
  // Edit modal styles
  editModalContainer: {
    width: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  editModalTitle: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
    marginBottom: 20,
  },
  editModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
  },
  updateButton: {
    backgroundColor: "#3B82F6",
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    color: "#4B5563",
  },
  updateButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    color: "#FFFFFF",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6B7280",
    fontFamily: "Nunito_400Regular",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateImage: {
    width: 200,
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    fontFamily: "Nunito_400Regular",
    textAlign: "center",

    paddingHorizontal: 20,
  },
});
