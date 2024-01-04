/* eslint-disable consistent-return */
/* eslint-disable no-throw-literal */
/* eslint-disable max-len */
/* eslint-disable default-case */
/* eslint-disable func-names */
/* eslint-disable no-var */
/* eslint-disable no-plusplus */
/* eslint-disable no-loop-func */
/* eslint-disable vars-on-top */
/* eslint-disable no-shadow */
/**
 * © Copyright IBM Corp. 2016, 2018 All Rights Reserved
 *   Project name: JSONata
 *   This project is licensed under the MIT License, see LICENSE
 */

const utils = require('./utils');

const signature = (() => {
  // A mapping between the function signature symbols and the full plural of the type
  // Expected to be used in error messages
  const arraySignatureMapping = {
    a: 'arrays',
    b: 'booleans',
    f: 'functions',
    n: 'numbers',
    o: 'objects',
    s: 'strings',
  };

  /**
     * Parses a function signature definition and returns a validation function
     * @param {string} signature - the signature between the <angle brackets>
     * @returns {Function} validation function
     */
  function parseSignature(signature) {
    // create a Regex that represents this signature and return a function that when invoked,
    // returns the validated (possibly fixed-up) arguments, or throws a validation error
    // step through the signature, one symbol at a time
    let position = 1;
    const params = [];
    let param = {};
    let prevParam = param;
    while (position < signature.length) {
      var symbol = signature.charAt(position);
      if (symbol === ':') {
        // TODO figure out what to do with the return type
        // ignore it for now
        break;
      }

      const next = function () {
        params.push(param);
        prevParam = param;
        param = {};
      };

      const findClosingBracket = function (str, start, openSymbol, closeSymbol) {
        // returns the position of the closing symbol (e.g. bracket) in a string
        // that balances the opening symbol at position start
        let depth = 1;
        let position = start;
        while (position < str.length) {
          position++;
          symbol = str.charAt(position);
          if (symbol === closeSymbol) {
            depth--;
            if (depth === 0) {
              // we're done
              break; // out of while loop
            }
          } else if (symbol === openSymbol) {
            depth++;
          }
        }
        return position;
      };

      switch (symbol) {
        case 's': // string
        case 'n': // number
        case 'b': // boolean
        case 'l': // not so sure about expecting null?
        case 'o': // object
          param.regex = `[${symbol}m]`;
          param.type = symbol;
          next();
          break;
        case 'a': // array
          //  normally treat any value as singleton array
          param.regex = '[asnblfom]';
          param.type = symbol;
          param.array = true;
          next();
          break;
        case 'f': // function
          param.regex = 'f';
          param.type = symbol;
          next();
          break;
        case 'j': // any JSON type
          param.regex = '[asnblom]';
          param.type = symbol;
          next();
          break;
        case 'x': // any type
          param.regex = '[asnblfom]';
          param.type = symbol;
          next();
          break;
        case '-': // use context if param not supplied
          prevParam.context = true;
          prevParam.contextRegex = new RegExp(prevParam.regex); // pre-compiled to test the context type at runtime
          prevParam.regex += '?';
          break;
        case '?': // optional param
        case '+': // one or more
          prevParam.regex += symbol;
          break;
        case '(': // choice of types
          // search forward for matching ')'
          var endParen = findClosingBracket(signature, position, '(', ')');
          var choice = signature.substring(position + 1, endParen);
          if (choice.indexOf('<') === -1) {
            // no parameterized types, simple regex
            param.regex = `[${choice}m]`;
          } else {
            // TODO harder
            throw {
              code: 'S0402',
              stack: (new Error()).stack,
              value: choice,
              offset: position,
            };
          }
          param.type = `(${choice})`;
          position = endParen;
          next();
          break;
        case '<': // type parameter - can only be applied to 'a' and 'f'
          if (prevParam.type === 'a' || prevParam.type === 'f') {
            // search forward for matching '>'
            const endPos = findClosingBracket(signature, position, '<', '>');
            prevParam.subtype = signature.substring(position + 1, endPos);
            position = endPos;
          } else {
            throw {
              code: 'S0401',
              stack: (new Error()).stack,
              value: prevParam.type,
              offset: position,
            };
          }
          break;
      }
      position++;
    }
    const regexStr = `^${
      params.map((param) => `(${param.regex})`).join('')
    }$`;
    const regex = new RegExp(regexStr);
    const getSymbol = function (value) {
      let symbol;
      if (utils.isFunction(value)) {
        symbol = 'f';
      } else {
        const type = typeof value;
        switch (type) {
          case 'string':
            symbol = 's';
            break;
          case 'number':
            symbol = 'n';
            break;
          case 'boolean':
            symbol = 'b';
            break;
          case 'object':
            if (value === null) {
              symbol = 'l';
            } else if (Array.isArray(value)) {
              symbol = 'a';
            } else {
              symbol = 'o';
            }
            break;
          case 'undefined':
          default:
            // any value can be undefined, but should be allowed to match
            symbol = 'm'; // m for missing
        }
      }
      return symbol;
    };

    const throwValidationError = function (badArgs, badSig) {
      // to figure out where this went wrong we need apply each component of the
      // regex to each argument until we get to the one that fails to match
      let partialPattern = '^';
      let goodTo = 0;
      for (let index = 0; index < params.length; index++) {
        partialPattern += params[index].regex;
        const match = badSig.match(partialPattern);
        if (match === null) {
          // failed here
          throw {
            code: 'T0410',
            stack: (new Error()).stack,
            value: badArgs[goodTo],
            index: goodTo + 1,
          };
        }
        goodTo = match[0].length;
      }
      // if it got this far, it's probably because of extraneous arguments (we
      // haven't added the trailing '$' in the regex yet.
      throw {
        code: 'T0410',
        stack: (new Error()).stack,
        value: badArgs[goodTo],
        index: goodTo + 1,
      };
    };

    return {
      definition: signature,
      validate(args, context) {
        let suppliedSig = '';
        args.forEach((arg) => {
          suppliedSig += getSymbol(arg);
        });
        const isValid = regex.exec(suppliedSig);
        if (isValid) {
          const validatedArgs = [];
          let argIndex = 0;
          params.forEach((param, index) => {
            let arg = args[argIndex];
            const match = isValid[index + 1];
            if (match === '') {
              if (param.context && param.contextRegex) {
                // substitute context value for missing arg
                // first check that the context value is the right type
                const contextType = getSymbol(context);
                // test contextType against the regex for this arg (without the trailing ?)
                if (param.contextRegex.test(contextType)) {
                  validatedArgs.push(context);
                } else {
                  // context value not compatible with this argument
                  throw {
                    code: 'T0411',
                    stack: (new Error()).stack,
                    value: context,
                    index: argIndex + 1,
                  };
                }
              } else {
                validatedArgs.push(arg);
                argIndex++;
              }
            } else {
              // may have matched multiple args (if the regex ends with a '+'
              // split into single tokens
              match.split('').forEach((single) => {
                if (param.type === 'a') {
                  if (single === 'm') {
                    // missing (undefined)
                    arg = undefined;
                  } else {
                    arg = args[argIndex];
                    let arrayOK = true;
                    // is there type information on the contents of the array?
                    if (typeof param.subtype !== 'undefined') {
                      if (single !== 'a' && match !== param.subtype) {
                        arrayOK = false;
                      } else if (single === 'a') {
                        if (arg.length > 0) {
                          const itemType = getSymbol(arg[0]);
                          if (itemType !== param.subtype.charAt(0)) { // TODO recurse further
                            arrayOK = false;
                          } else {
                            // make sure every item in the array is this type
                            const differentItems = arg.filter((val) => (getSymbol(val) !== itemType));
                            arrayOK = (differentItems.length === 0);
                          }
                        }
                      }
                    }
                    if (!arrayOK) {
                      throw {
                        code: 'T0412',
                        stack: (new Error()).stack,
                        value: arg,
                        index: argIndex + 1,
                        type: arraySignatureMapping[param.subtype],
                      };
                    }
                    // the function expects an array. If it's not one, make it so
                    if (single !== 'a') {
                      arg = [arg];
                    }
                  }
                  validatedArgs.push(arg);
                  argIndex++;
                } else {
                  validatedArgs.push(arg);
                  argIndex++;
                }
              });
            }
          });
          return validatedArgs;
        }
        throwValidationError(args, suppliedSig);
      },
    };
  }

  return parseSignature;
})();

module.exports = signature;
