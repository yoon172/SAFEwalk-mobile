import React, { useEffect, useContext } from "react";
import {Keyboard, StyleSheet, Text, View} from "react-native";
import socket from "../../contexts/socket";

import { WalkContext } from "./../../contexts/WalkProvider";
import {Notifications} from "expo";
import * as Permissions from "expo-permissions";
import Constants from "expo-constants";

export default function UserMapScreen({ navigation }) {
  const { startLat, startLng, destLat, destLng, resetWalkContextState } = useContext(WalkContext);

  /**
   * This effect sets up the socket connection to the User.
   * This effect is run once upon component mount.
   */
  useEffect(() => {
    socket.removeAllListeners();

    socket.on("walker location", ({ lat, lng }) => {
      console.log(lat + "," + lng);
    });

    // socket to listen to walker status change
    socket.on("walker walk status", (status) => {
      switch (status) {
        // SAFEwalker has canceled the walk
        case -2:
          // reset walk state to change navigation to InactiveWalk Screens
          resetWalkContextState();
          alert("The SAFEwalker has canceled the walk.");
          break;
        // walk has been marked as completed by the SAFEwalker
        case 2:
          resetWalkContextState();
          alert("The walk has been completed!");
          break;

        default:
          console.log(
            "Unexpected socket status received in UserMapScreen: status " +
            status
          );
      }
    });

    socket.on("connection lost", (status) => {
      if (status) {
        setNotification(1000);
        alert("Connection Lost");
        // TODO: button to cancel walk, call cancelWalk()
      }
    });

    // cleanup socket
    return () => {
      socket.off("walker location", null);
      socket.off("walker walk status", null);
      socket.off("connection lost", null);
    };
  }, []);

  /* Notification Setup
  setNotification: schedules notification for <time>
  */
  const connectionNotification = { title: 'Connection Error', body: 'Connection Lost' };
  let localNotificationId = null;
  const setNotification = time => {
    Keyboard.dismiss();
    console.log("Notification set for " + time);
    const schedulingOptions = {
      time: new Date().getTime() + Number(time),
    };
    // Notifications show only when app is not active.
    // (ie. another app being used or device's screen is locked)
    localNotificationId  = Notifications.scheduleLocalNotificationAsync(
        connectionNotification,
        schedulingOptions,
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.mapStyle}
        showsUserLocation={true}
        ref={mapRef}
        minZoomLevel={10}
        maxZoomLevel={15}
        onMapReady={onMapReady}
      >
        {markers.map((marker) => (
          <MapView.Marker
            key={marker.key}
            coordinate={{
              latitude: marker.coordinates.latitude,
              longitude: marker.coordinates.longitude
            }}
            title={marker.title}
            pinColor={pinColor[marker.key]}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
