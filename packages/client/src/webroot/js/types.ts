const TEMPLATE_SERVER_MSG = {
  type: "string",
  message: "string"
};


/**
 * This function returns true if the json contains all of the properties in
 * templateJSON and those properties have the same type as specified by templateJSON.
 * 
 * Note that json can have properties not in templateJSON and this function will still be
 * true due to duck typing. "If it quacks like a duck, it is a duck".
 * @param json - the JSON we want to check
 * @param templateJSON a JSON that marks each of its properties with another JSON
 * or a string containing the desired type of the property. These type strings
 * are based on the output of the typeof method in Javascript.
 * (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof). 
 * This JSON is formatted as:
 * {
 *  "val": "number"
 *  "arr": [
 *    "0": "number"
 *  ],
 *  "val2": {
 *     "a": "boolean",
 *     "b": "object"
 *  }
 * }
 * 
 */
export function jsonContainsThesePropsWithTypes(json: Object, templateJSON: Object) {
  if(json == null || json == undefined || typeof json !== "object") {
    return false;
  }
  if(templateJSON == null || templateJSON == undefined || typeof templateJSON !== "object") {
    return false;
  }
  
  let objectQueue = [json];
  let jsonTypeObjectQueue = [templateJSON];

  while(objectQueue.length > 0) {
    let obj = objectQueue[0] as any;
    let currentJSONLevel = jsonTypeObjectQueue[0] as any;

    let objKeys = Object.keys(obj);
    let jsonTypeObjKeys = Object.keys(currentJSONLevel);


    //if obj is empty and the type specified for that object is not empty
    if(objKeys.length == 0 && jsonTypeObjKeys.length > 0) {
      return false;
    } 

    for(let key of jsonTypeObjKeys) {
      //if obj is missing property from templateJSON
      if(!obj.hasOwnProperty(key)) {
        return false;
      }

      let type = typeof currentJSONLevel[key];

      if(type !== "object") {
        if(typeof obj[key] !== type) {
          return false;
        }
      } else if(obj[key] !== null){
        objectQueue.push(obj[key]);
        jsonTypeObjectQueue.push(currentJSONLevel[key]);
      }
      
      //shift removes first element and shifts items once to left of array
      objectQueue.shift();
      jsonTypeObjectQueue.shift();
    }

  }

  return true;
}
/**
 * Determines if the json parameter q
 * @param json - a JSON object to check
 * @param properties - contains an array of either strings or arrays of strings. 
 * If a property is an array of strings, it represents a nested property that we want to find.
 * Example: if properties = ["one", ["two", "a"]], this function will check if the
 * following JSON is defined:
 * {
 *   "one": <val>,
 *   "two": {
 *     "a": <val>
 *   }
 * }
 * @returns whether or not the json contains all of the properties specified in properties 
 */
export function jsonHasProperties(json: Object, ...properties : Array<string | Array<string>>) {
  if(typeof json != "object") {
    return false;
  }

  //https://stackoverflow.com/questions/2631001/test-for-existence-of-nested-javascript-object-key
  let hasNested = (json: Object, nestedPropertyLevels: string[]) => {
    for(let level of nestedPropertyLevels) {
      if(!json || !json.hasOwnProperty(level)) {
        return false;
      }

      //@ts-ignore
      json = json[level];
    }
    return true;
  }

  //check each top level property
  for(let prop of properties) {
    if(typeof prop == "string") {
      if(!json.hasOwnProperty(prop)) {
        return false;
      }
    } else if(Array.isArray(prop)) {
      if(!hasNested(json, prop)) {
        return false;
      }
    } 
  }

  return true;
}