import React, { useState, useEffect, useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-elements";
import { Linking } from "expo";
import { Ionicons, FontAwesome } from "@expo/vector-icons";

// Constants
import colors from "./../../constants/colors";
import socket from "./../../contexts/socket";
import url from "./../../constants/api";

// Contexts
import { AuthContext } from "./../../contexts/AuthProvider";
import { WalkContext } from "./../../contexts/WalkProvider";

export default function SafewalkerProfileScreen({ navigation }) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const { userToken, email } = useContext(AuthContext);
  const {
    walkId,
    walkerSocketId,
    setWalkerInfo,
    resetWalkContextState,
  } = useContext(WalkContext);

  /**
   * This effect sets up the socket connection to listen to responses by the SAFEwalker.
   * This effect also retrieves the SAFEwalker information from the database.
   * This effect is run once upon component mount.
   */
  useEffect(() => {
    // this is to fix memory leak error: Promise cleanup
    const firstFetchloadWalkerProfileController = new AbortController();
    const secondFetchloadWalkerProfileController = new AbortController();
    const signalFirstFetch = firstFetchloadWalkerProfileController.signal;
    const signalSecondFetch = secondFetchloadWalkerProfileController.signal;

    loadWalkerProfile(signalFirstFetch, signalSecondFetch);

    // socket to listen to walker status change
    socket.on("walker walk status", (status) => {
      switch (status) {
        // SAFEwalker has canceled the walk.
        case -2:
          resetWalkContextState();
          alert("The SAFEwalker has canceled the walk.");
          break;

        // SAFEwalker has marked the walk as completed
        case 2:
          resetWalkContextState();
          alert("The walk has been completed!");
          break;

        default:
          console.log(
            "Unexpected socket status received in SafewalkerProfileScreen: status " +
              status
          );
      }
    });

    // cleanups
    return () => {
      socket.off("walker walk status", null);
      firstFetchloadWalkerProfileController.abort();
      secondFetchloadWalkerProfileController.abort();
    };
  }, []);

  /**
   * Loads the SAFEwalker profile from the database and fills them in local state
   *
   * @param signalOne cancels the first fetch request when component is unmounted.
   * @param signalTwo cancels the second fetch request when component is unmounted.
   */
  async function loadWalkerProfile(signalOne, signalTwo) {
    let walkerEmail; // retrieved in first API call, used in the second API call below

    try {
      // Get Walk API call
      // retrieve the SAFEwalker email and socket ID
      const res = await fetch(url + "/api/Walks/" + walkId, {
        method: "GET",
        headers: {
          token: userToken,
          email: email,
          isUser: true,
        },
        signal: signalOne,
      });

      let status = res.status;

      // Upon fetch failure/bad status
      if (status != 200 && status != 201) {
        console.log(
          "get SAFEwalker email & socket ID in loadWalkerProfile() in SafewalkerProfileScreen failed: status " +
            status
        );
        return;
      }

      // Upon fetch success, store walker data in Context
      else {
        const data = await res.json();
        walkerEmail = data["walkerEmail"];
        const walkerSocketId = data["walkerSocketId"];

        // store walker data in Context
        setWalkerInfo(walkerEmail, walkerSocketId);
      }
    } catch (error) {
      /**
       * When the component unmounts, the AbortController will cancel any recurring fetch requests.
       * When that happens (i.e. fetch cancel), it throws an AbortError error.
       * So we catch this error to differentiate it from other errors.
       * This is the same as if (error.name === "AbortError")
       */
      if (signalOne.aborted) {
        return;
      }

      console.error(
        "Error in retrieving SAFEwalker email and walker ID in loadWalkerProfile() in SafewalkerProfileScreen:" +
          error
      );
    }

    try {
      // Get Walker API call
      // Get the SAFEwalker's name and phone number
      const res = await fetch(url + "/api/Safewalkers/" + walkerEmail, {
        method: "GET",
        headers: {
          token: userToken,
          email: email,
          isUser: true,
        },
        signal: signalTwo,
      });

      let status = res.status;

      // Upon fetch failure/bad status
      if (status != 200 && status != 201) {
        console.log(
          "get SAFEwalker name & phone number in loadWalkerProfile() in SafewalkerProfileScreen failed: status " +
            status
        );
        return;
      }

      // Upon fetch success
      else {
        const data = await res.json();

        // update retrieved SAFEwalker profile info in local state
        setFirstname(data["firstName"]);
        setLastname(data["lastName"]);
        setPhoneNumber(data["phoneNumber"]);
      }
    } catch (error) {
      /**
       * When the component unmounts, the AbortController will cancel any recurring fetch requests.
       * When that happens (i.e. fetch cancel), it throws an AbortError error.
       * So we catch this error to differentiate it from other errors.
       * This is the same as if (error.name === "AbortError")
       */
      if (signalTwo.aborted) {
        return;
      }

      console.error(
        "Error in retrieving SAFEwalker name and phone number in loadWalkerProfile() in SafewalkerProfileScreen:" +
          error
      );
    }
  }

  /**
   * Upon button press, User cancels the walk.
   */
  async function cancelWalk() {
    try {
      // Delete Walk API call
      // Delete the cancelled walk in the database
      const res = await fetch(url + "/api/Walks/" + walkId, {
        method: "DELETE",
        headers: {
          token: userToken,
          email: email,
          isUser: true,
        },
      });

      let status = res.status;

      // Upon delete failure/bad status
      if (status != 200 && status != 201) {
        console.log("delete walk failed: status " + status);
        return;
      }

      // Upon successful delete
      else {
        if (walkerSocketId) {
          // notify the SAFEwalker that the walk has been cancelled
          socket.emit("user walk status", {
            walkerId: walkerSocketId,
            status: -2,
          });
        }

        // reset the Walk states
        // This will bring navigation to InactiveWalk screens
        resetWalkContextState();
        alert("Canceled Walk");
      }
    } catch (error) {
      console.error(
        "Error in deleting a walk in cancelWalk() in SafewalkerProfileScreen:" +
          error
      );
    }
  }

  function handleCall() {
    Linking.openURL("tel:+1" + phoneNumber);
  }

  function handleText() {
    Linking.openURL("sms:+1" + phoneNumber);
  }

  return (
    <View style={styles.container}>
      <FontAwesome
        name="user-circle"
        size={100}
        style={styles.profilePicture}
      />
      <Text style={styles.textName}>
        {firstname} {lastname}
      </Text>
      <View style={styles.buttonContactContainer}>
        <Button
          icon={<Ionicons name="ios-call" size={60} color={colors.white} />}
          buttonStyle={styles.buttonCall}
          onPress={() => handleCall()}
        />
        <Button
          icon={<Ionicons name="md-text" size={60} color={colors.white} />}
          buttonStyle={styles.buttonText}
          onPress={() => handleText()}
        />
      </View>

      <Button
        title="Cancel"
        buttonStyle={styles.buttonCancel}
        onPress={() => cancelWalk()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "stretch",
    justifyContent: "center",
  },
  profilePicture: {
    alignSelf: "center",
    marginBottom: 30,
  },
  textName: {
    alignSelf: "center",
    fontSize: 30,
    marginBottom: 40,
  },
  buttonContactContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: 100,
  },
  buttonCall: {
    backgroundColor: colors.gray,
    borderRadius: 15,
    width: 80,
    height: 80,
  },
  buttonText: {
    backgroundColor: colors.gray,
    borderRadius: 15,
    width: 80,
    height: 80,
  },
  buttonCancel: {
    marginBottom: 40,
    height: 60,
    borderRadius: 50,
    backgroundColor: colors.red,
    marginHorizontal: 40,
  },
});
