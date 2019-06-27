import { update, getTime, refreshDefaults } from './reducerUtil'

let defaultSettings = {
  deviceToken: null,
  updatedAt: 1
};

let installationReducer = (state = defaultSettings, action : any = {}) => {
  switch (action.type) {
    case 'ADD_INSTALLATION':
    case 'UPDATE_INSTALLATION_CONFIG':
      if (action.data) {
        let newState = {...state};
        newState.deviceToken = update(action.data.deviceToken, newState.deviceToken);
        newState.updatedAt   = getTime(action.data.updatedAt);
        return newState;
      }
      return state;
    case 'REFRESH_DEFAULTS':
      return refreshDefaults(state, defaultSettings);
    default:
      return state;
  }
};


// devices Reducer
export default (state = {}, action : any = {}) => {
  switch (action.type) {
    case 'REMOVE_INSTALLATION':
      let newState = {...state};
      delete newState[action.installationId];
      return newState;
    default:
      if (action.installationId !== undefined) {
        if (state[action.installationId] !== undefined || action.type === "ADD_INSTALLATION") {
          return {
            ...state,
            ...{[action.installationId]: installationReducer(state[action.installationId], action)}
          };
        }
      }
      return state;
  }
};
