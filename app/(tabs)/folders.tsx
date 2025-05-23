import { db } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const folderWidth = (width - 60) / 2;

interface Folder {
  id: string;
  name: string;
  description: string;
  notes: Note[];
  createdAt: number;
  userId: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}

const FolderScreen = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [folderDetailVisible, setFolderDetailVisible] = useState(false);
  const [newNoteVisible, setNewNoteVisible] = useState(false);
  const [viewNoteVisible, setViewNoteVisible] = useState(false);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [optionsVisible, setOptionsVisible] = useState<string | null>(null);
  const [noteOptionsVisible, setNoteOptionsVisible] = useState<string | null>(
    null
  );
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<Folder | Note | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Function to fetch folders
  const fetchFolders = useCallback(async () => {
    if (!user) {
      setFolders([]);
      setLoading(false);
      return;
    }

    console.log("Fetching folders for user:", user.uid);
    setLoading(true);

    try {
      const foldersRef = collection(db, "folders");
      const q = query(foldersRef, where("userId", "==", user.uid));

      const querySnapshot = await getDocs(q);
      const foldersList: Folder[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Convert Firestore timestamp to number
        let createdAtTime = Date.now();
        if (data.createdAt) {
          if (data.createdAt.toMillis) {
            createdAtTime = data.createdAt.toMillis();
          } else if (typeof data.createdAt === "number") {
            createdAtTime = data.createdAt;
          }
        }

        foldersList.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          notes: data.notes || [],
          createdAt: createdAtTime,
          userId: data.userId,
        });
      });

      console.log("Folders fetched:", foldersList.length);
      setFolders(foldersList);
    } catch (error) {
      console.error("Error fetching folders:", error);
      Alert.alert("Error", "Failed to load folders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load folders when component mounts
  useEffect(() => {
    if (!user) {
      setFolders([]);
      setLoading(false);
      return;
    }

    fetchFolders();

    // Setup real-time updates
    const foldersRef = collection(db, "folders");
    const q = query(foldersRef, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const foldersList: Folder[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();

          // Convert Firestore timestamp to number
          let createdAtTime = Date.now();
          if (data.createdAt) {
            if (data.createdAt.toMillis) {
              createdAtTime = data.createdAt.toMillis();
            } else if (typeof data.createdAt === "number") {
              createdAtTime = data.createdAt;
            }
          }

          foldersList.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            notes: data.notes || [],
            createdAt: createdAtTime,
            userId: data.userId,
          });
        });

        console.log("Folders updated via snapshot:", foldersList.length);
        setFolders(foldersList);
        setLoading(false);
      },
      (error) => {
        console.error("Error in snapshot listener:", error);
      }
    );

    // Cleanup function
    return () => unsubscribe();
  }, [user]);

  // Refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchFolders();
    }, [fetchFolders])
  );

  const handleCreateFolder = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to create folders");
      return;
    }

    if (newFolderName.trim() === "") return;

    try {
      setLoading(true);
      if (editMode && editingItem) {
        // Update existing folder
        const folderRef = doc(db, "folders", (editingItem as Folder).id);
        await updateDoc(folderRef, {
          name: newFolderName,
          description: newFolderDesc,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new folder with numeric timestamp for consistency
        const now = Date.now();
        const newFolder = {
          name: newFolderName,
          description: newFolderDesc,
          notes: [],
          createdAt: now, // Use numeric timestamp instead of serverTimestamp()
          userId: user.uid,
        };

        console.log("Creating new folder:", newFolder);
        const docRef = await addDoc(collection(db, "folders"), newFolder);
        console.log("Created folder with ID:", docRef.id);

        // After creating, trigger a refresh
        setTimeout(() => {
          fetchFolders();
        }, 500);
      }

      resetFolderForm();
      Alert.alert(
        "Success",
        editMode
          ? "Folder updated successfully!"
          : "Folder created successfully!"
      );
    } catch (error) {
      console.error("Error creating/updating folder:", error);
      Alert.alert(
        "Error",
        "Failed to save folder. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetFolderForm = () => {
    setNewFolderName("");
    setNewFolderDesc("");
    setNewFolderVisible(false);
    setEditMode(false);
    setEditingItem(null);
  };

  const handleSaveNote = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to create notes");
      return;
    }

    if (newNoteTitle.trim() === "" || !currentFolder) return;

    try {
      setLoading(true);
      const folderRef = doc(db, "folders", currentFolder.id);

      if (editMode && editingItem) {
        // Update existing note by removing old one and adding updated one
        const oldNote = editingItem as Note;
        const updatedNote = {
          id: oldNote.id,
          title: newNoteTitle,
          content: newNoteContent,
          timestamp: new Date().toISOString(),
        };

        // Get current folder data
        const folderSnap = await getDoc(folderRef);
        const folderData = folderSnap.data();

        if (folderData) {
          // Filter out the old note and add the updated one
          const updatedNotes = folderData.notes.filter(
            (note: Note) => note.id !== oldNote.id
          );
          updatedNotes.push(updatedNote);

          // Update the folder with the new notes array
          await updateDoc(folderRef, {
            notes: updatedNotes,
            updatedAt: Date.now(), // Use numeric timestamp
          });

          // Update current folder state
          if (currentFolder) {
            const updatedFolder = {
              ...currentFolder,
              notes: updatedNotes,
            };
            setCurrentFolder(updatedFolder);
          }
        }

        Alert.alert("Success", "Note updated successfully!");
      } else {
        // Create new note
        const newNote = {
          id: Date.now().toString(),
          title: newNoteTitle,
          content: newNoteContent,
          timestamp: new Date().toISOString(),
        };

        // Add new note to the folder's notes array
        await updateDoc(folderRef, {
          notes: arrayUnion(newNote),
          updatedAt: Date.now(), // Use numeric timestamp
        });

        // Update current folder state
        if (currentFolder) {
          const updatedFolder = {
            ...currentFolder,
            notes: [...currentFolder.notes, newNote],
          };
          setCurrentFolder(updatedFolder);
        }

        Alert.alert("Success", "Note created successfully!");
      }

      resetNoteForm();
    } catch (error) {
      console.error("Error saving note:", error);
      Alert.alert(
        "Error",
        "Failed to save note. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetNoteForm = () => {
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteVisible(false);
    setEditMode(false);
    setEditingItem(null);
  };

  const deleteFolder = async (folderId: string) => {
    if (!user) return;

    Alert.alert(
      "Delete Folder",
      "Are you sure you want to delete this folder and all its notes?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoc(doc(db, "folders", folderId));
              setOptionsVisible(null);

              // Refresh the folders list
              setTimeout(() => {
                fetchFolders();
              }, 500);

              Alert.alert("Success", "Folder deleted successfully!");
            } catch (error) {
              console.error("Error deleting folder:", error);
              Alert.alert(
                "Error",
                "Failed to delete folder. Please check your connection and try again."
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteNote = async (noteId: string) => {
    if (!currentFolder || !user) return;

    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            const folderRef = doc(db, "folders", currentFolder.id);
            const folderSnap = await getDoc(folderRef);
            const folderData = folderSnap.data();

            if (folderData) {
              // Find the note to delete
              const noteToDelete = folderData.notes.find(
                (note: Note) => note.id === noteId
              );

              if (noteToDelete) {
                // Remove the note from the array
                await updateDoc(folderRef, {
                  notes: arrayRemove(noteToDelete),
                  updatedAt: Date.now(), // Use numeric timestamp
                });

                // Update local state
                const updatedNotes = currentFolder.notes.filter(
                  (note) => note.id !== noteId
                );
                setCurrentFolder({
                  ...currentFolder,
                  notes: updatedNotes,
                });

                // If we're viewing a note that's being deleted, close the view
                if (viewingNote && viewingNote.id === noteId) {
                  setViewNoteVisible(false);
                }
              }
            }

            setNoteOptionsVisible(null);
            Alert.alert("Success", "Note deleted successfully!");
          } catch (error) {
            console.error("Error deleting note:", error);
            Alert.alert(
              "Error",
              "Failed to delete note. Please check your connection and try again."
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const editFolder = (folder: Folder) => {
    setEditMode(true);
    setEditingItem(folder);
    setNewFolderName(folder.name);
    setNewFolderDesc(folder.description);
    setNewFolderVisible(true);
    setOptionsVisible(null);
  };

  const editNote = (note: Note) => {
    setEditMode(true);
    setEditingItem(note);
    setNewNoteTitle(note.title);
    setNewNoteContent(note.content);
    setNewNoteVisible(true);
    setNoteOptionsVisible(null);
    setViewNoteVisible(false);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setViewNoteVisible(true);
    setNoteOptionsVisible(null);
  };

  const openFolder = async (folder: Folder) => {
    if (!user) return;

    // Get the latest folder data from Firestore
    try {
      setLoading(true);
      const folderRef = doc(db, "folders", folder.id);
      const folderSnap = await getDoc(folderRef);

      if (folderSnap.exists()) {
        const folderData = folderSnap.data();

        // Convert Firestore timestamp to number if needed
        let createdAtTime = Date.now();
        if (folderData.createdAt) {
          if (folderData.createdAt.toMillis) {
            createdAtTime = folderData.createdAt.toMillis();
          } else if (typeof folderData.createdAt === "number") {
            createdAtTime = folderData.createdAt;
          }
        }

        const updatedFolder = {
          id: folderSnap.id,
          name: folderData.name,
          description: folderData.description,
          notes: folderData.notes || [],
          createdAt: createdAtTime,
          userId: folderData.userId,
        };
        setCurrentFolder(updatedFolder);
        setFolderDetailVisible(true);
      } else {
        Alert.alert("Error", "This folder no longer exists.");
      }
    } catch (error) {
      console.error("Error opening folder:", error);
      Alert.alert(
        "Error",
        "Failed to open folder. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFolderItem = ({ item }: { item: Folder }) => (
    <TouchableOpacity
      style={styles.folderItem}
      onPress={() => openFolder(item)}
      activeOpacity={0.8}
    >
      <TouchableOpacity
        style={styles.folderOptions}
        onPress={() =>
          setOptionsVisible(optionsVisible === item.id ? null : item.id)
        }
      >
        <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
      </TouchableOpacity>

      {optionsVisible === item.id && (
        <View style={styles.optionsMenu}>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => editFolder(item)}
          >
            <MaterialIcons
              name="edit"
              size={16}
              color="#4CAF50"
              style={styles.optionIcon}
            />
            <Text style={styles.optionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => deleteFolder(item.id)}
          >
            <MaterialIcons
              name="delete"
              size={16}
              color="#F44336"
              style={styles.optionIcon}
            />
            <Text style={[styles.optionText, { color: "#F44336" }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.folderIconContainer}>
        <MaterialIcons name="folder" size={64} color="#FCA5A5" />
      </View>
      <Text style={styles.folderName} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  // Format date for display
  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }

      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandText}>keeply.</Text>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Folders</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={22}
          color={colors.lightpink}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search folders..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Folder Grid */}
      <View style={styles.folderGrid}>
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.lightpink} />
            <Text style={styles.loaderText}>Loading folders...</Text>
          </View>
        ) : filteredFolders.length === 0 && !searchQuery ? (
          <View style={styles.emptyState}>
            <Image
              source={require("@/assets/images/folders.jpg")}
              style={styles.emptyStateImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>No folders created yet</Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => {
                setNewFolderVisible(true);
                setEditMode(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyStateButtonText}>
                Create your first folder
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredFolders.length === 0 && searchQuery ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="search-off" size={70} color="#E0E0E0" />
            <Text style={styles.emptyText}>No matching folders found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredFolders}
            renderItem={renderFolderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.folderList}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={fetchFolders}
          />
        )}
      </View>

      {/* Add Folder Button */}
      {!folderDetailVisible && !viewNoteVisible && folders.length > 0 && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setNewFolderVisible(true);
            setEditMode(false);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}

      {/* New Folder Modal */}
      <Modal
        visible={newFolderVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNewFolderVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNewFolderVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {editMode ? "Edit Folder" : "New Folder"}
                </Text>

                <View style={styles.folderIconLarge}>
                  <MaterialIcons name="folder" size={100} color="#FCA5A5" />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Folder Name</Text>
                  <View style={styles.textInputContainer}>
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color="#FCA5A5"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter folder name"
                      value={newFolderName}
                      onChangeText={setNewFolderName}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <View style={styles.textInputContainer}>
                    <Ionicons
                      name="create-outline"
                      size={22}
                      color="#FCA5A5"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Enter folder description (optional)"
                      value={newFolderDesc}
                      onChangeText={setNewFolderDesc}
                      multiline
                      textAlignVertical="top"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={resetFolderForm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      !newFolderName.trim() && styles.disabledButton,
                      loading && styles.disabledButton,
                    ]}
                    onPress={handleCreateFolder}
                    disabled={!newFolderName.trim() || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.createButtonText}>
                        {editMode ? "Save" : "Create"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Folder Detail View (non-modal to show system navigation) */}
      {folderDetailVisible && (
        <View style={styles.folderDetailView}>
          <SafeAreaView style={styles.folderDetailContainer}>
            {/* Header */}
            <View style={styles.folderDetailHeader}>
              <TouchableOpacity
                onPress={() => setFolderDetailVisible(false)}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.folderDetailTitle}>
                {currentFolder?.name}
              </Text>
              <View style={styles.headerRightSpace} />
            </View>

            {/* Fixed folder header section */}
            <View style={styles.folderHeaderContainer}>
              {/* Center folder icon instead of pink box */}
              <View style={styles.folderCenteredIcon}>
                <MaterialIcons name="folder" size={64} color="#FCA5A5" />
              </View>
              <Text style={styles.folderDescription}>
                {currentFolder?.description || ""}
              </Text>
              <View style={styles.divider} />
            </View>

            {/* Scrollable notes section */}
            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={colors.lightpink} />
                <Text style={styles.loaderText}>Loading notes...</Text>
              </View>
            ) : (
              <FlatList
                data={currentFolder?.notes || []}
                keyExtractor={(note) => note.id}
                renderItem={({ item: note }) => (
                  <TouchableOpacity
                    style={styles.noteCard}
                    onPress={() => handleViewNote(note)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.noteCardHeader}>
                      <Text style={styles.noteCardDate}>
                        {formatShortDate(note.timestamp)}
                      </Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setNoteOptionsVisible(
                            noteOptionsVisible === note.id ? null : note.id
                          );
                        }}
                      >
                        <MaterialIcons
                          name="more-horiz"
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                    {noteOptionsVisible === note.id && (
                      <View style={styles.noteOptionsMenu}>
                        <TouchableOpacity
                          style={styles.optionItem}
                          onPress={() => editNote(note)}
                        >
                          <MaterialIcons
                            name="edit"
                            size={16}
                            color="#4CAF50"
                            style={styles.optionIcon}
                          />
                          <Text style={styles.optionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.optionItem}
                          onPress={() => deleteNote(note.id)}
                        >
                          <MaterialIcons
                            name="delete"
                            size={16}
                            color="#F44336"
                            style={styles.optionIcon}
                          />
                          <Text
                            style={[styles.optionText, { color: "#F44336" }]}
                          >
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <Text style={styles.noteCardTitle}>{note.title}</Text>
                    <Text style={styles.noteCardText} numberOfLines={2}>
                      {note.content}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.emptyNotesContainer}>
                    <Image
                      source={require("@/assets/images/notes.jpg")}
                      style={styles.emptyStateImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.emptyNotesText}>
                      No notes in this folder yet
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyNotesButton}
                      onPress={() => {
                        setNewNoteVisible(true);
                        setEditMode(false);
                      }}
                    >
                      <Text style={styles.emptyNotesButtonText}>
                        Create your first note
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListFooterComponent={() =>
                  currentFolder?.notes && currentFolder.notes.length > 0 ? (
                    <TouchableOpacity
                      style={styles.addNoteCard}
                      onPress={() => {
                        setNewNoteVisible(true);
                        setEditMode(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.addNoteCenter}>
                        <MaterialIcons name="add" size={30} color="#999" />
                      </View>
                    </TouchableOpacity>
                  ) : null
                }
                contentContainerStyle={[
                  styles.notesListContainer,
                  (!currentFolder?.notes ||
                    currentFolder.notes.length === 0) && {
                    flex: 1,
                  },
                ]}
              />
            )}
          </SafeAreaView>
        </View>
      )}

      {/* Note View (non-modal to show system navigation) */}
      {viewNoteVisible && (
        <View style={styles.folderDetailView}>
          <SafeAreaView style={styles.cleanNoteContainer}>
            <View style={styles.noteDetailHeader}>
              <TouchableOpacity
                onPress={() => setViewNoteVisible(false)}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#000" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.folderDetailTitle}>
                  {currentFolder?.name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (viewingNote) {
                    editNote(viewingNote);
                  }
                }}
              >
                <Ionicons name="create-outline" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.fullHeightNoteContainer}>
              <Text style={styles.noteViewDate}>
                {formatShortDate(viewingNote?.timestamp || "")}
              </Text>
              <Text style={styles.noteViewTitle}>{viewingNote?.title}</Text>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <Text style={styles.noteViewContent}>
                  {viewingNote?.content}
                </Text>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* New Note Modal */}
      <Modal
        visible={newNoteVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNewNoteVisible(false)}
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
      >
        <View
          style={{
            flex: 1,
            marginBottom: 83, // Add space for the tab bar
            backgroundColor: "rgba(255,255,255,0.95)", // Near-white but slightly transparent
          }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.noteDetailHeader}>
              <TouchableOpacity
                onPress={resetNoteForm}
                style={styles.backButton}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={24} color="#000" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.folderDetailTitle}>
                  {editMode ? "Edit Note" : "New Note"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.backButton,
                  !newNoteTitle.trim() && { opacity: 0.5 },
                ]}
                onPress={handleSaveNote}
                disabled={!newNoteTitle.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.lightpink} />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={24}
                    color={!newNoteTitle.trim() ? "#ccc" : colors.lightpink}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Paper-like note appearance */}
            <View
              style={[
                styles.fullHeightNoteContainer,
                {
                  borderColor: "#000",
                  borderWidth: 1,
                  backgroundColor: "#FFFFFE",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                },
              ]}
            >
              <Text style={[styles.noteViewDate, { color: "#9CA3AF" }]}>
                {new Date().toLocaleString()}
              </Text>

              <TextInput
                style={[
                  styles.noteViewTitle,
                  {
                    fontSize: 24,
                    fontWeight: "700",
                    marginBottom: 16,
                    color: "#1F2937",
                  },
                ]}
                placeholder="Title"
                value={newNoteTitle}
                onChangeText={setNewNoteTitle}
                placeholderTextColor="#9CA3AF"
              />

              <TextInput
                style={[
                  styles.noteViewContent,
                  {
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 24,
                    color: "#4B5563",
                    textAlignVertical: "top",
                  },
                ]}
                placeholder="Write your note here..."
                value={newNoteContent}
                onChangeText={setNewNoteContent}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Global Loading Overlay */}
      {loading && (
        <View style={styles.globalLoadingOverlay}>
          <ActivityIndicator size="large" color={colors.lightpink} />
        </View>
      )}
    </SafeAreaView>
  );
};

export default FolderScreen;

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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  folderGrid: {
    flex: 1,
    marginTop: 0,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
    color: colors.lightpink,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    color: "#374151",
    padding: 12,
  },
  folderList: {
    paddingBottom: 80,
  },
  folderItem: {
    width: "44%", // Change from fixed width to percentage-based
    marginHorizontal: "3%", // Use percentage for margins too
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  folderIconContainer: {
    position: "relative",
    marginBottom: 12,
    marginTop: 8,
  },
  folderOptions: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 5,
    zIndex: 5,
  },
  folderBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FCA5A5",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    paddingHorizontal: 5,
  },
  folderBadgeText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  folderName: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
    maxWidth: folderWidth - 32,
    color: "#374151",
    fontFamily: "Nunito_600SemiBold",
  },
  optionsMenu: {
    position: "absolute",
    top: 38,
    right: 8,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 5,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 100,
    minWidth: 120,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  optionItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: {
    marginRight: 10,
  },
  optionText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
  },
  emptyState: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyStateImage: {
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    color: "#6B7280",
    marginBottom: 15,
    fontFamily: "Nunito_600SemiBold",
    textAlign: "center",
  },
  emptyStateButton: {
    backgroundColor: "#FECACA",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyStateButtonText: {
    color: "#991B1B",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#FCA5A5",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    zIndex: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    minHeight: "70%",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
  },
  folderIconLarge: {
    alignSelf: "center",
    marginBottom: 24,
    borderRadius: 50,
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "600",
    color: "#4B5563",
    fontFamily: "Nunito_600SemiBold",
  },
  textInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputIcon: {
    paddingLeft: 14,
    paddingTop: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#374151",
    fontFamily: "Nunito_400Regular",
  },
  multilineInput: {
    height: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    width: "48%",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  createButton: {
    backgroundColor: "#FCA5A5",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "48%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: "#FECACA",
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
  },
  folderDetailView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
    zIndex: 10,
  },
  folderDetailContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  folderDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  folderDetailTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    color: "#000",
  },
  headerRightSpace: {
    width: 40,
  },
  folderHeaderContainer: {
    padding: 16,
    alignItems: "center",
  },
  folderCenteredIcon: {
    marginVertical: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  folderDescription: {
    padding: 5,
    color: "#333",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 16,
    width: "100%",
  },
  notesListContainer: {
    paddingBottom: 80,
  },
  noteCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderColor: "#000",
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#FFF9BE",
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  noteCardDate: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Nunito_400Regular",
  },
  noteCardTitle: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    marginBottom: 4,
  },
  noteCardText: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Nunito_400Regular",
    lineHeight: 20,
  },
  noteOptionsMenu: {
    position: "absolute",
    top: 30,
    right: 8,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 50,
    borderWidth: 1,
    borderColor: "#eee",
    minWidth: 100,
  },
  emptyNotesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyNotesText: {
    fontSize: 18,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "Nunito_600SemiBold",
  },
  emptyNotesButton: {
    backgroundColor: "#FECACA",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyNotesButtonText: {
    color: "#991B1B",
    fontWeight: "600",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
  },
  addNoteCard: {
    backgroundColor: "#FFF9BE",
    marginHorizontal: 16,
    marginVertical: 14,
    marginBottom: 80,
    borderRadius: 8,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  addNoteCenter: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  noteModalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  noteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  noteModalBack: {
    marginRight: 15,
    padding: 5,
  },
  cancelNoteText: {
    color: "#F44336",
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
  },
  saveNoteText: {
    color: "#4CAF50",
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  noteModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    flex: 1,
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
    textAlign: "center",
  },
  saveNoteButton: {
    padding: 8,
  },
  disabledSaveButton: {
    opacity: 0.5,
  },
  noteModalContent: {
    flex: 1,
    padding: 16,
  },
  currentDateTime: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 20,
    fontFamily: "Nunito_400Regular",
  },
  noteTitleInput: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1F2937",
    fontFamily: "Nunito_700Bold",
  },
  noteContentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: "#4B5563",
    fontFamily: "Nunito_400Regular",
  },
  noteDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  noteDetailContent: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  noteDetailCard: {
    margin: 16,
    backgroundColor: "#FFF9C4",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fullHeightNoteContainer: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: "#000000",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: "#FFF",
  },
  noteViewerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
    fontFamily: "Nunito_700Bold",
  },
  noteViewerText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
    fontFamily: "Nunito_400Regular",
  },
  noteViewContainer: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    margin: 16,
    backgroundColor: "#FFF",
  },
  cleanNoteContainer: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  noteViewFullContainer: {
    flex: 1,
    padding: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFF",
  },
  noteViewDate: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    fontFamily: "Nunito_400Regular",
  },
  noteViewTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#000",
    fontFamily: "Nunito_700Bold",
  },
  noteViewContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4B5563",
    fontFamily: "Nunito_400Regular",
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
  globalLoadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    zIndex: 1000,
  },
});
