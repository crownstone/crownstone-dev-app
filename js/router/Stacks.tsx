import { Languages } from "../Languages";

export const Stacks = {

  initial: function() : StackData {
    return {
      component: {
        name: "Initializer"
      },
    }
  },

  searchingForCrownstones: function() : StackData {
    return {
      bottomTabs: {
        children: [
          {
            stack: {
              children: [
                { component: {name: "StoneSelector"} },
              ],
              options: {
                bottomTab: {
                  text: "Select",
                  icon: require('../images/icons/searching.png'),
                }
              }
            }
          },
          {
            stack: {
              children: [
                { component: {name: "UserData"} },
              ],
              options: {
                bottomTab: {
                  text: "User Settings",
                  icon: require('../images/icons/user.png'),
                }
              }
            }
          },
        ]
      }
    }
  },

  firmwareTesting: function(props) : StackData {
    return {
      bottomTabs: {
        id: 'bottomTabs',
        children: [
          {
            stack: {
              children: [
                { component: {name: "FirmwareTest", passProps: props} },
              ],
              options: {
                bottomTab: {
                  text: "Operations",
                  icon: require('../images/icons/switches.png'),
                }
              }
            }
          },
          {
            stack: {
              children: [
                { component: {name: "AdvancedConfig", passProps: props} },
              ],
              options: {
                bottomTab: {
                  text: "Advanced",
                  icon: require('../images/icons/cog.png'),
                }
              }
            }
          },
          {
            stack: {
              children: [
                { component: {name: "RawAdvertisements", passProps: props} },
              ],
              options: {
                bottomTab: {
                  text: "Advertisments",
                  icon: require('../images/icons/mail.png'),
                }
              }
            }
          },
          {
            stack: {
              children: [
                { component: {name: "UserData"} },
              ],
              options: {
                bottomTab: {
                  text: "User Settings",
                  icon: require('../images/icons/user.png'),
                }
              }
            }
          },
        ]
      }
    }
  },

  logout: function() : StackData {
    return {
      component: {
        name: "Logout"
      }
    }
  },
}