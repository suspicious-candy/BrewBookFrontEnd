import { View, Text, StyleSheet, Pressable} from 'react-native'
import{Link} from "expo-router"
import React from 'react'

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>BrewBook</Text>
      <Link href="/Login" asChild>
        <Pressable>
         <Text style={styles.text}> Login</Text>
         </Pressable>
      </Link>
    </View>
  )
}

export default App

const styles = StyleSheet.create({
  container:{
    flex:1,
    flexDirection:'column'
  },
  text:{
    color:'white',
    fontSize:32,
    fontWeight:'bold'
  }
})