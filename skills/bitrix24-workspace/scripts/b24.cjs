#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/commander/lib/error.js
var require_error = __commonJS({
  "node_modules/commander/lib/error.js"(exports2) {
    var CommanderError2 = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError2 = class extends CommanderError2 {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports2.CommanderError = CommanderError2;
    exports2.InvalidArgumentError = InvalidArgumentError2;
  }
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "node_modules/commander/lib/argument.js"(exports2) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Argument2 = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.endsWith("...")) {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports2.Argument = Argument2;
    exports2.humanReadableArgName = humanReadableArgName;
  }
});

// node_modules/commander/lib/help.js
var require_help = __commonJS({
  "node_modules/commander/lib/help.js"(exports2) {
    var { humanReadableArgName } = require_argument();
    var Help2 = class {
      constructor() {
        this.helpWidth = void 0;
        this.minWidthToWrap = 40;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
       * and just before calling `formatHelp()`.
       *
       * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
       *
       * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
       */
      prepareContext(contextOptions) {
        this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions) return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleSubcommandTerm(helper.subcommandTerm(command))
            )
          );
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleArgumentTerm(helper.argumentTerm(argument))
            )
          );
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (option.description) {
            return `${option.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return argument.description;
      }
      /**
       * Format a list of items, given a heading and an array of formatted items.
       *
       * @param {string} heading
       * @param {string[]} items
       * @param {Help} helper
       * @returns string[]
       */
      formatItemList(heading, items, helper) {
        if (items.length === 0) return [];
        return [helper.styleTitle(heading), ...items, ""];
      }
      /**
       * Group items by their help group heading.
       *
       * @param {Command[] | Option[]} unsortedItems
       * @param {Command[] | Option[]} visibleItems
       * @param {Function} getGroup
       * @returns {Map<string, Command[] | Option[]>}
       */
      groupItems(unsortedItems, visibleItems, getGroup) {
        const result = /* @__PURE__ */ new Map();
        unsortedItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) result.set(group, []);
        });
        visibleItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) {
            result.set(group, []);
          }
          result.get(group).push(item);
        });
        return result;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth ?? 80;
        function callFormatItem(term, description) {
          return helper.formatItem(term, termWidth, description, helper);
        }
        let output = [
          `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
          ""
        ];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.boxWrap(
              helper.styleCommandDescription(commandDescription),
              helpWidth
            ),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return callFormatItem(
            helper.styleArgumentTerm(helper.argumentTerm(argument)),
            helper.styleArgumentDescription(helper.argumentDescription(argument))
          );
        });
        output = output.concat(
          this.formatItemList("Arguments:", argumentList, helper)
        );
        const optionGroups = this.groupItems(
          cmd.options,
          helper.visibleOptions(cmd),
          (option) => option.helpGroupHeading ?? "Options:"
        );
        optionGroups.forEach((options, group) => {
          const optionList = options.map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(this.formatItemList(group, optionList, helper));
        });
        if (helper.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(
            this.formatItemList("Global Options:", globalOptionList, helper)
          );
        }
        const commandGroups = this.groupItems(
          cmd.commands,
          helper.visibleCommands(cmd),
          (sub) => sub.helpGroup() || "Commands:"
        );
        commandGroups.forEach((commands, group) => {
          const commandList = commands.map((sub) => {
            return callFormatItem(
              helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
              helper.styleSubcommandDescription(helper.subcommandDescription(sub))
            );
          });
          output = output.concat(this.formatItemList(group, commandList, helper));
        });
        return output.join("\n");
      }
      /**
       * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
       *
       * @param {string} str
       * @returns {number}
       */
      displayWidth(str2) {
        return stripColor(str2).length;
      }
      /**
       * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
       *
       * @param {string} str
       * @returns {string}
       */
      styleTitle(str2) {
        return str2;
      }
      styleUsage(str2) {
        return str2.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word === "[command]") return this.styleSubcommandText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleCommandText(word);
        }).join(" ");
      }
      styleCommandDescription(str2) {
        return this.styleDescriptionText(str2);
      }
      styleOptionDescription(str2) {
        return this.styleDescriptionText(str2);
      }
      styleSubcommandDescription(str2) {
        return this.styleDescriptionText(str2);
      }
      styleArgumentDescription(str2) {
        return this.styleDescriptionText(str2);
      }
      styleDescriptionText(str2) {
        return str2;
      }
      styleOptionTerm(str2) {
        return this.styleOptionText(str2);
      }
      styleSubcommandTerm(str2) {
        return str2.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleSubcommandText(word);
        }).join(" ");
      }
      styleArgumentTerm(str2) {
        return this.styleArgumentText(str2);
      }
      styleOptionText(str2) {
        return str2;
      }
      styleArgumentText(str2) {
        return str2;
      }
      styleSubcommandText(str2) {
        return str2;
      }
      styleCommandText(str2) {
        return str2;
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
       *
       * @param {string} str
       * @returns {boolean}
       */
      preformatted(str2) {
        return /\n[^\S\r\n]/.test(str2);
      }
      /**
       * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
       *
       * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
       *   TTT  DDD DDDD
       *        DD DDD
       *
       * @param {string} term
       * @param {number} termWidth
       * @param {string} description
       * @param {Help} helper
       * @returns {string}
       */
      formatItem(term, termWidth, description, helper) {
        const itemIndent = 2;
        const itemIndentStr = " ".repeat(itemIndent);
        if (!description) return itemIndentStr + term;
        const paddedTerm = term.padEnd(
          termWidth + term.length - helper.displayWidth(term)
        );
        const spacerWidth = 2;
        const helpWidth = this.helpWidth ?? 80;
        const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
        let formattedDescription;
        if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
          formattedDescription = description;
        } else {
          const wrappedDescription = helper.boxWrap(description, remainingWidth);
          formattedDescription = wrappedDescription.replace(
            /\n/g,
            "\n" + " ".repeat(termWidth + spacerWidth)
          );
        }
        return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
      }
      /**
       * Wrap a string at whitespace, preserving existing line breaks.
       * Wrapping is skipped if the width is less than `minWidthToWrap`.
       *
       * @param {string} str
       * @param {number} width
       * @returns {string}
       */
      boxWrap(str2, width) {
        if (width < this.minWidthToWrap) return str2;
        const rawLines = str2.split(/\r\n|\n/);
        const chunkPattern = /[\s]*[^\s]+/g;
        const wrappedLines = [];
        rawLines.forEach((line) => {
          const chunks = line.match(chunkPattern);
          if (chunks === null) {
            wrappedLines.push("");
            return;
          }
          let sumChunks = [chunks.shift()];
          let sumWidth = this.displayWidth(sumChunks[0]);
          chunks.forEach((chunk) => {
            const visibleWidth = this.displayWidth(chunk);
            if (sumWidth + visibleWidth <= width) {
              sumChunks.push(chunk);
              sumWidth += visibleWidth;
              return;
            }
            wrappedLines.push(sumChunks.join(""));
            const nextChunk = chunk.trimStart();
            sumChunks = [nextChunk];
            sumWidth = this.displayWidth(nextChunk);
          });
          wrappedLines.push(sumChunks.join(""));
        });
        return wrappedLines.join("\n");
      }
    };
    function stripColor(str2) {
      const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
      return str2.replace(sgrPattern, "");
    }
    exports2.Help = Help2;
    exports2.stripColor = stripColor;
  }
});

// node_modules/commander/lib/option.js
var require_option = __commonJS({
  "node_modules/commander/lib/option.js"(exports2) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Option2 = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
        this.helpGroupHeading = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as an object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        if (this.negate) {
          return camelcase(this.name().replace(/^no-/, ""));
        }
        return camelcase(this.name());
      }
      /**
       * Set the help group heading.
       *
       * @param {string} heading
       * @return {Option}
       */
      helpGroup(heading) {
        this.helpGroupHeading = heading;
        return this;
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey)) return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str2) {
      return str2.split("-").reduce((str3, word) => {
        return str3 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const shortFlagExp = /^-[^-]$/;
      const longFlagExp = /^--[^-]/;
      const flagParts = flags.split(/[ |,]+/).concat("guard");
      if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
      if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
      if (!shortFlag && shortFlagExp.test(flagParts[0]))
        shortFlag = flagParts.shift();
      if (!shortFlag && longFlagExp.test(flagParts[0])) {
        shortFlag = longFlag;
        longFlag = flagParts.shift();
      }
      if (flagParts[0].startsWith("-")) {
        const unsupportedFlag = flagParts[0];
        const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
        if (/^-[^-][^-]/.test(unsupportedFlag))
          throw new Error(
            `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`
          );
        if (shortFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many short flags`);
        if (longFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many long flags`);
        throw new Error(`${baseError}
- unrecognised flag format`);
      }
      if (shortFlag === void 0 && longFlag === void 0)
        throw new Error(
          `option creation failed due to no flags found in '${flags}'.`
        );
      return { shortFlag, longFlag };
    }
    exports2.Option = Option2;
    exports2.DualOptions = DualOptions;
  }
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "node_modules/commander/lib/suggestSimilar.js"(exports2) {
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0) return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1) return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports2.suggestSimilar = suggestSimilar;
  }
});

// node_modules/commander/lib/command.js
var require_command = __commonJS({
  "node_modules/commander/lib/command.js"(exports2) {
    var EventEmitter = require("node:events").EventEmitter;
    var childProcess = require("node:child_process");
    var path4 = require("node:path");
    var fs4 = require("node:fs");
    var process2 = require("node:process");
    var { Argument: Argument2, humanReadableArgName } = require_argument();
    var { CommanderError: CommanderError2 } = require_error();
    var { Help: Help2, stripColor } = require_help();
    var { Option: Option2, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class _Command extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = false;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._savedState = null;
        this._outputConfiguration = {
          writeOut: (str2) => process2.stdout.write(str2),
          writeErr: (str2) => process2.stderr.write(str2),
          outputError: (str2, write) => write(str2),
          getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
          getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
          getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
          getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
          stripColor: (str2) => stripColor(str2)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
        this._helpGroupHeading = void 0;
        this._defaultCommandGroup = void 0;
        this._defaultOptionGroup = void 0;
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args) cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc) return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new _Command(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help2(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0) return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // change how output being written, defaults to stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // change how output being written for errors, defaults to writeErr
       *     outputError(str, write) // used for displaying errors and not used for displaying help
       *     // specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // color support, currently only used with Help
       *     getOutHasColors()
       *     getErrHasColors()
       *     stripColor() // used to remove ANSI escape codes if output does not have colors
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0) return this._outputConfiguration;
        this._outputConfiguration = {
          ...this._outputConfiguration,
          ...configuration
        };
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden) cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument2(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom argument processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, parseArg, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof parseArg === "function") {
          argument.default(defaultValue).argParser(parseArg);
        } else {
          argument.default(parseArg);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument?.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          if (enableOrNameAndArgs && this._defaultCommandGroup) {
            this._initCommandGroup(this._getHelpCommand());
          }
          return this;
        }
        const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs) helpCommand.arguments(helpArgs);
        if (helpDescription) helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err) => {
            if (err.code !== "commander.executeSubCommandAsync") {
              throw err;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError2(exitCode, code, message));
        }
        process2.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option2(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err) {
          if (err.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err.message}`;
            this.error(message, { exitCode: err.exitCode, code: err.code });
          }
          throw err;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this._initOptionGroup(option);
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this._initCommandGroup(command);
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._collectValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option2) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process2.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process2.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process2.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process2.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      _prepareForParse() {
        if (this._savedState === null) {
          this.saveStateBeforeParse();
        } else {
          this.restoreStateBeforeParse();
        }
      }
      /**
       * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state saved.
       */
      saveStateBeforeParse() {
        this._savedState = {
          // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
          _name: this._name,
          // option values before parse have default values (including false for negated options)
          // shallow clones
          _optionValues: { ...this._optionValues },
          _optionValueSources: { ...this._optionValueSources }
        };
      }
      /**
       * Restore state before parse for calls after the first.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state restored.
       */
      restoreStateBeforeParse() {
        if (this._storeOptionsAsProperties)
          throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
        this._name = this._savedState._name;
        this._scriptPath = null;
        this.rawArgs = [];
        this._optionValues = { ...this._savedState._optionValues };
        this._optionValueSources = { ...this._savedState._optionValueSources };
        this.args = [];
        this.processedArgs = [];
      }
      /**
       * Throw if expected executable is missing. Add lots of help for author.
       *
       * @param {string} executableFile
       * @param {string} executableDir
       * @param {string} subcommandName
       */
      _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
        if (fs4.existsSync(executableFile)) return;
        const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
        const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
        throw new Error(executableMissing);
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path4.resolve(baseDir, baseName);
          if (fs4.existsSync(localBin)) return localBin;
          if (sourceExt.includes(path4.extname(baseName))) return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs4.existsSync(`${localBin}${ext}`)
          );
          if (foundExt) return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs4.realpathSync(this._scriptPath);
          } catch {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path4.resolve(
            path4.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path4.basename(
              this._scriptPath,
              path4.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path4.extname(executableFile));
        let proc;
        if (process2.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process2.execArgv).concat(args);
            proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          this._checkForMissingExecutable(
            executableFile,
            executableDir,
            subcommand._name
          );
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process2.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process2.exit(code);
          } else {
            exitCallback(
              new CommanderError2(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err) => {
          if (err.code === "ENOENT") {
            this._checkForMissingExecutable(
              executableFile,
              executableDir,
              subcommand._name
            );
          } else if (err.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process2.exit(1);
          } else {
            const wrappedError = new CommanderError2(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand) this.help({ error: true });
        subCommand._prepareForParse();
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise?.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent?.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name) return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Side effects: modifies command by storing options. Does not reset state if called again.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} args
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(args) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        const negativeNumberArg = (arg) => {
          if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
          return !this._getCommandAndAncestors().some(
            (cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short))
          );
        };
        let activeVariadicOption = null;
        let activeGroup = null;
        let i = 0;
        while (i < args.length || activeGroup) {
          const arg = activeGroup ?? args[i++];
          activeGroup = null;
          if (arg === "--") {
            if (dest === unknown) dest.push(arg);
            dest.push(...args.slice(i));
            break;
          }
          if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args[i++];
                if (value === void 0) this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                  value = args[i++];
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                activeGroup = `-${arg.slice(2)}`;
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              unknown.push(...args.slice(i));
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg, ...args.slice(i));
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg, ...args.slice(i));
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg, ...args.slice(i));
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process2.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption) return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments) return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str2, flags, description) {
        if (str2 === void 0) return this._version;
        this._version = str2;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str2}
`);
          this._exit(0, "commander.version", str2);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str2, argsDescription) {
        if (str2 === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str2;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str2) {
        if (str2 === void 0) return this._summary;
        this._summary = str2;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0) return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases) {
        if (aliases === void 0) return this._aliases;
        aliases.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str2) {
        if (str2 === void 0) {
          if (this._usage) return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str2;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str2) {
        if (str2 === void 0) return this._name;
        this._name = str2;
        return this;
      }
      /**
       * Set/get the help group heading for this subcommand in parent command's help.
       *
       * @param {string} [heading]
       * @return {Command | string}
       */
      helpGroup(heading) {
        if (heading === void 0) return this._helpGroupHeading ?? "";
        this._helpGroupHeading = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for subcommands added to this command.
       * (This does not override a group set directly on the subcommand using .helpGroup().)
       *
       * @example
       * program.commandsGroup('Development Commands:);
       * program.command('watch')...
       * program.command('lint')...
       * ...
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      commandsGroup(heading) {
        if (heading === void 0) return this._defaultCommandGroup ?? "";
        this._defaultCommandGroup = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for options added to this command.
       * (This does not override a group set directly on the option using .helpGroup().)
       *
       * @example
       * program
       *   .optionsGroup('Development Options:')
       *   .option('-d, --debug', 'output extra debugging')
       *   .option('-p, --profile', 'output profiling information')
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      optionsGroup(heading) {
        if (heading === void 0) return this._defaultOptionGroup ?? "";
        this._defaultOptionGroup = heading;
        return this;
      }
      /**
       * @param {Option} option
       * @private
       */
      _initOptionGroup(option) {
        if (this._defaultOptionGroup && !option.helpGroupHeading)
          option.helpGroup(this._defaultOptionGroup);
      }
      /**
       * @param {Command} cmd
       * @private
       */
      _initCommandGroup(cmd) {
        if (this._defaultCommandGroup && !cmd.helpGroup())
          cmd.helpGroup(this._defaultCommandGroup);
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path4.basename(filename, path4.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path5) {
        if (path5 === void 0) return this._executableDir;
        this._executableDir = path5;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        const context = this._getOutputContext(contextOptions);
        helper.prepareContext({
          error: context.error,
          helpWidth: context.helpWidth,
          outputHasColors: context.hasColors
        });
        const text = helper.formatHelp(this, helper);
        if (context.hasColors) return text;
        return this._outputConfiguration.stripColor(text);
      }
      /**
       * @typedef HelpContext
       * @type {object}
       * @property {boolean} error
       * @property {number} helpWidth
       * @property {boolean} hasColors
       * @property {function} write - includes stripColor if needed
       *
       * @returns {HelpContext}
       * @private
       */
      _getOutputContext(contextOptions) {
        contextOptions = contextOptions || {};
        const error = !!contextOptions.error;
        let baseWrite;
        let hasColors;
        let helpWidth;
        if (error) {
          baseWrite = (str2) => this._outputConfiguration.writeErr(str2);
          hasColors = this._outputConfiguration.getErrHasColors();
          helpWidth = this._outputConfiguration.getErrHelpWidth();
        } else {
          baseWrite = (str2) => this._outputConfiguration.writeOut(str2);
          hasColors = this._outputConfiguration.getOutHasColors();
          helpWidth = this._outputConfiguration.getOutHelpWidth();
        }
        const write = (str2) => {
          if (!hasColors) str2 = this._outputConfiguration.stripColor(str2);
          return baseWrite(str2);
        };
        return { error, write, hasColors, helpWidth };
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const outputContext = this._getOutputContext(contextOptions);
        const eventContext = {
          error: outputContext.error,
          write: outputContext.write,
          command: this
        };
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
        this.emit("beforeHelp", eventContext);
        let helpInformation = this.helpInformation({ error: outputContext.error });
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        outputContext.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", eventContext);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", eventContext)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            if (this._helpOption === null) this._helpOption = void 0;
            if (this._defaultOptionGroup) {
              this._initOptionGroup(this._getHelpOption());
            }
          } else {
            this._helpOption = null;
          }
          return this;
        }
        this._helpOption = this.createOption(
          flags ?? "-h, --help",
          description ?? "display help for command"
        );
        if (flags || description) this._initOptionGroup(this._helpOption);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        this._initOptionGroup(option);
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = Number(process2.exitCode ?? 0);
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * // Do a little typing to coordinate emit and listener for the help text events.
       * @typedef HelpTextEventContext
       * @type {object}
       * @property {boolean} error
       * @property {Command} command
       * @property {function} write
       */
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    function useColor() {
      if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
        return false;
      if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== void 0)
        return true;
      return void 0;
    }
    exports2.Command = Command2;
    exports2.useColor = useColor;
  }
});

// node_modules/commander/index.js
var require_commander = __commonJS({
  "node_modules/commander/index.js"(exports2) {
    var { Argument: Argument2 } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError: CommanderError2, InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2 } = require_option();
    exports2.program = new Command2();
    exports2.createCommand = (name) => new Command2(name);
    exports2.createOption = (flags, description) => new Option2(flags, description);
    exports2.createArgument = (name, description) => new Argument2(name, description);
    exports2.Command = Command2;
    exports2.Option = Option2;
    exports2.Argument = Argument2;
    exports2.Help = Help2;
    exports2.CommanderError = CommanderError2;
    exports2.InvalidArgumentError = InvalidArgumentError2;
    exports2.InvalidOptionArgumentError = InvalidArgumentError2;
  }
});

// node_modules/dotenv/lib/main.js
var require_main = __commonJS({
  "node_modules/dotenv/lib/main.js"(exports2, module2) {
    var fs4 = require("fs");
    var path4 = require("path");
    var os2 = require("os");
    var crypto2 = require("crypto");
    var TIPS = [
      "\u25C8 encrypted .env [www.dotenvx.com]",
      "\u25C8 secrets for agents [www.dotenvx.com]",
      "\u2301 auth for agents [www.vestauth.com]",
      "\u2318 custom filepath { path: '/custom/path/.env' }",
      "\u2318 enable debugging { debug: true }",
      "\u2318 override existing { override: true }",
      "\u2318 suppress logs { quiet: true }",
      "\u2318 multiple files { path: ['.env.local', '.env'] }"
    ];
    function _getRandomTip() {
      return TIPS[Math.floor(Math.random() * TIPS.length)];
    }
    function parseBoolean(value) {
      if (typeof value === "string") {
        return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
      }
      return Boolean(value);
    }
    function supportsAnsi() {
      return process.stdout.isTTY;
    }
    function dim(text) {
      return supportsAnsi() ? `\x1B[2m${text}\x1B[0m` : text;
    }
    var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
    function parse(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/mg, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++) {
        try {
          const key = keys[i].trim();
          const attrs = _instructions(result, key);
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) {
            throw error;
          }
        }
      }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.error(`\u26A0 ${message}`);
    }
    function _debug(message) {
      console.log(`\u2506 ${message}`);
    }
    function _log(message) {
      console.log(`\u25C7 ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
        return options.DOTENV_KEY;
      }
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
        return process.env.DOTENV_KEY;
      }
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = new Error("INVALID_DOTENV_KEY: Missing key part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return { ciphertext, key };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0) {
        if (Array.isArray(options.path)) {
          for (const filepath of options.path) {
            if (fs4.existsSync(filepath)) {
              possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
            }
          }
        } else {
          possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
        }
      } else {
        possibleVaultPath = path4.resolve(process.cwd(), ".env.vault");
      }
      if (fs4.existsSync(possibleVaultPath)) {
        return possibleVaultPath;
      }
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~" ? path4.join(os2.homedir(), envPath.slice(1)) : envPath;
    }
    function _configVault(options) {
      const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
      const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
      if (debug || !quiet) {
        _log("loading env from encrypted .env.vault");
      }
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path4.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
      let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
      if (options && options.encoding) {
        encoding = options.encoding;
      } else {
        if (debug) {
          _debug("no encoding is specified (UTF-8 is used by default)");
        }
      }
      let optionPaths = [dotenvPath];
      if (options && options.path) {
        if (!Array.isArray(options.path)) {
          optionPaths = [_resolveHome(options.path)];
        } else {
          optionPaths = [];
          for (const filepath of options.path) {
            optionPaths.push(_resolveHome(filepath));
          }
        }
      }
      let lastError;
      const parsedAll = {};
      for (const path5 of optionPaths) {
        try {
          const parsed = DotenvModule.parse(fs4.readFileSync(path5, { encoding }));
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) {
            _debug(`failed to load ${path5} ${e.message}`);
          }
          lastError = e;
        }
      }
      const populated = DotenvModule.populate(processEnv, parsedAll, options);
      debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
      quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
      if (debug || !quiet) {
        const keysCount = Object.keys(populated).length;
        const shortPaths = [];
        for (const filePath of optionPaths) {
          try {
            const relative = path4.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) {
              _debug(`failed to load ${filePath} ${e.message}`);
            }
            lastError = e;
          }
        }
        _log(`injected env (${keysCount}) from ${shortPaths.join(",")} ${dim(`// tip: ${_getRandomTip()}`)}`);
      }
      if (lastError) {
        return { parsed: parsedAll, error: lastError };
      } else {
        return { parsed: parsedAll };
      }
    }
    function config(options) {
      if (_dotenvKey(options).length === 0) {
        return DotenvModule.configDotenv(options);
      }
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(`you set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}`);
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto2.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else {
          throw error;
        }
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      const populated = {};
      if (typeof parsed !== "object") {
        const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed)) {
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
            populated[key] = parsed[key];
          }
          if (debug) {
            if (override === true) {
              _debug(`"${key}" is already defined and WAS overwritten`);
            } else {
              _debug(`"${key}" is already defined and was NOT overwritten`);
            }
          }
        } else {
          processEnv[key] = parsed[key];
          populated[key] = parsed[key];
        }
      }
      return populated;
    }
    var DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config,
      decrypt,
      parse,
      populate
    };
    module2.exports.configDotenv = DotenvModule.configDotenv;
    module2.exports._configVault = DotenvModule._configVault;
    module2.exports._parseVault = DotenvModule._parseVault;
    module2.exports.config = DotenvModule.config;
    module2.exports.decrypt = DotenvModule.decrypt;
    module2.exports.parse = DotenvModule.parse;
    module2.exports.populate = DotenvModule.populate;
    module2.exports = DotenvModule;
  }
});

// node_modules/commander/esm.mjs
var import_index = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  // deprecated old name
  Command,
  Argument,
  Option,
  Help
} = import_index.default;

// src/api/errors.ts
var AppError = class extends Error {
  code;
  userMessage;
  details;
  constructor(params) {
    super(`${params.code}: ${params.userMessage}`, { cause: params.cause });
    this.name = "AppError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.details = params.details;
  }
};

// src/config/config.ts
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var APP_NAME = "bitrix24-workspace-skill";
var APP_VERSION = "0.1.0";
var CLI_NAME = "b24";
var CONFIG_DIR = import_node_path.default.join(import_node_os.default.homedir(), ".config", "bitrix24-workspace");
var ENV_PATH = import_node_path.default.join(CONFIG_DIR, ".env");
var ENV_PATH_DISPLAY = "~/.config/bitrix24-workspace/.env";
var WEBHOOK_ENV = "BITRIX24_WORKSPACE_WEBHOOK_URL";
var DEBUG_ENV = "B24_DEBUG";
var USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
var MIN_REQUEST_INTERVAL_MS = 500;
var REQUEST_TIMEOUT_MS = 6e4;
var DOWNLOAD_IDLE_TIMEOUT_MS = 6e4;
var UPDATE_CHECK_URL = "https://raw.githubusercontent.com/nyxandro/bitrix24-workspace-skill/main/package.json";
var UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1e3;
var UPDATE_CHECK_TIMEOUT_MS = 2500;
var UPDATE_CHECK_CACHE_PATH = import_node_path.default.join(CONFIG_DIR, "update-check.json");
var MAX_TEXT_CHARS = 4e3;
var MAX_MEMBERS = 50;

// src/cli/runtime.ts
var import_dotenv = __toESM(require_main(), 1);
var import_node_fs2 = __toESM(require("node:fs"), 1);

// src/api/client.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);

// src/api/allowlist.ts
var ALLOWED_V1 = /* @__PURE__ */ new Set([
  "scope",
  "user.current",
  "user.get",
  "user.search",
  "im.recent.list",
  "im.counters.get",
  "im.search.chat.list",
  "im.dialog.get",
  "im.dialog.users.list",
  "im.dialog.messages.get",
  "im.dialog.messages.search",
  "im.notify.get",
  "im.department.get",
  "im.department.managers.get",
  "im.department.employees.get",
  "im.department.colleagues.list",
  "im.search.department.list",
  "socialnetwork.api.workgroup.list",
  "socialnetwork.api.workgroup.get",
  "sonet_group.user.groups",
  "sonet_group.user.get",
  "tasks.task.list",
  "tasks.task.get",
  "task.checklistitem.getlist",
  "disk.storage.getlist",
  "disk.storage.getchildren",
  "disk.folder.getchildren",
  "disk.file.get",
  "disk.file.search",
  "calendar.event.get",
  "calendar.event.getbyid",
  "log.blogpost.get",
  "log.blogcomment.get",
  "timeman.status"
]);
var ALLOWED_V3 = /* @__PURE__ */ new Set([
  "mail.mailbox.list",
  "mail.message.list",
  "mail.message.get",
  "mail.message.thread",
  "call.followup.list",
  "call.followup.get",
  "note.collection.list",
  "note.document.search.list",
  "note.document.tree.list",
  "note.document.get",
  "timeman.record.list"
]);
var FORBIDDEN_WORDS = /* @__PURE__ */ new Set([
  "add",
  "update",
  "delete",
  "set",
  "send",
  "read",
  "unread",
  "mark",
  "move",
  "copy",
  "rename",
  "upload",
  "commit",
  "share",
  "external",
  "hide",
  "pin",
  "mute",
  "leave",
  "like",
  "answer",
  "confirm",
  "create",
  "start",
  "complete",
  "approve",
  "delegate",
  "restore",
  "forward",
  "reply",
  "open",
  "close",
  "pause",
  "remove",
  "defer",
  "renew",
  "stop",
  "attach",
  "archive",
  "invite",
  "join",
  "bind",
  "register",
  "save",
  "command",
  "writing",
  "terminate",
  "favorite"
]);
var READ_LAST_WORDS = /* @__PURE__ */ new Set([
  "get",
  "list",
  "search",
  "getlist",
  "getchildren",
  "getbyid",
  "thread",
  "current",
  "status",
  "groups",
  "scope"
]);
function splitMethodWords(method) {
  return method.split(/[._]/).flatMap((part) => part.split(/(?<=[a-z0-9])(?=[A-Z])/)).map((word) => word.toLowerCase()).filter((word) => word !== "");
}
function isForbiddenWord(word) {
  const stems = [word];
  for (const prefix of ["get", "un", "dis"]) {
    if (word.startsWith(prefix)) {
      stems.push(word.slice(prefix.length));
    }
  }
  return stems.some((stem) => [...FORBIDDEN_WORDS].some((verb) => stem.startsWith(verb)));
}
function isForbiddenName(method) {
  return splitMethodWords(method).some(isForbiddenWord);
}
function isReadOnlyShape(method) {
  const words = splitMethodWords(method);
  const last = words[words.length - 1];
  return last !== void 0 && READ_LAST_WORDS.has(last) && !isForbiddenName(method);
}
var SCOPE_BY_PREFIX = [
  ["scope", "basic"],
  ["user.", "user_basic"],
  ["im.", "im"],
  // socialnetwork.api.* требует отдельного права socialnetwork, а не sonet_group (проверено на портале).
  ["socialnetwork.", "socialnetwork"],
  ["sonet_group.", "sonet_group"],
  ["tasks.", "task"],
  ["task.", "task"],
  ["disk.", "disk"],
  ["calendar.", "calendar"],
  ["log.", "log"],
  ["timeman.", "timeman"],
  ["mail.", "mail"],
  ["call.", "call"],
  ["note.", "note"]
];
var SCOPE_SECTIONS = {
  basic: "\u043E\u0441\u043D\u043E\u0432\u0430",
  user_basic: "\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438",
  im: "\u0447\u0430\u0442\u044B, \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0438 \u043E\u0440\u0433\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430",
  sonet_group: "\u043F\u0440\u043E\u0435\u043A\u0442\u044B (\u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438)",
  socialnetwork: "\u043F\u0440\u043E\u0435\u043A\u0442\u044B (\u0441\u043F\u0438\u0441\u043E\u043A \u0438 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430)",
  task: "\u0437\u0430\u0434\u0430\u0447\u0438",
  disk: "\u0434\u0438\u0441\u043A",
  calendar: "\u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C",
  log: "\u0436\u0438\u0432\u0430\u044F \u043B\u0435\u043D\u0442\u0430",
  timeman: "\u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u0432\u0440\u0435\u043C\u044F",
  mail: "\u043F\u043E\u0447\u0442\u0430",
  call: "\u0438\u0442\u043E\u0433\u0438 \u0432\u0441\u0442\u0440\u0435\u0447",
  note: "\u0431\u0430\u0437\u0430 \u0437\u043D\u0430\u043D\u0438\u0439"
};
function scopeForMethod(method) {
  const hit = SCOPE_BY_PREFIX.find(([prefix]) => prefix.endsWith(".") ? method.startsWith(prefix) : method === prefix);
  return hit?.[1];
}

// src/api/bitrix-errors.ts
var AUTH_CODES = /* @__PURE__ */ new Set(["INVALID_CREDENTIALS", "NO_AUTH_FOUND", "INVALID_TOKEN", "EXPIRED_TOKEN", "WRONG_AUTH_TYPE"]);
var BAD_REQUEST_CODES = /* @__PURE__ */ new Set(["ERROR_ARGUMENT", "WRONG_ARGUMENTS", "INVALID_ARGUMENT", "INVALID_REQUEST"]);
function resetTime(epochSeconds) {
  if (epochSeconds === void 0 || !Number.isFinite(epochSeconds)) {
    return "\u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442";
  }
  const d = new Date(epochSeconds * 1e3);
  return `\u043F\u043E\u0441\u043B\u0435 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isBadRequestCode(upper) {
  return BAD_REQUEST_CODES.has(upper) || upper.startsWith("INVALID_") || upper.endsWith("_EMPTY") || upper.endsWith("_STRING") || upper.includes("VALIDATION") || upper.includes("INVALIDJSON") || upper.includes("UNKNOWNDTOPROPERTY") || upper.includes("UNKNOWNFILTEROPERATOR");
}
function mapBitrixError(input) {
  const upper = input.code.trim().toUpperCase();
  const description = input.description ?? "";
  const details = { bitrixCode: input.code, status: input.status, method: input.method, description: input.description };
  const make = (code, userMessage) => new AppError({ code, userMessage, details });
  const accessDenied = () => make("APP_B24_ACCESS_DENIED", "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430: \u0432\u044B \u043D\u0435 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u044D\u0442\u043E\u0433\u043E \u0447\u0430\u0442\u0430 \u0438\u043B\u0438 \u0443 \u0432\u0430\u0441 \u043D\u0435\u0442 \u043F\u0440\u0430\u0432 \u043D\u0430 \u044D\u0442\u043E\u0442 \u043E\u0431\u044A\u0435\u043A\u0442 \u0432 \u0411\u0438\u0442\u0440\u0438\u043A\u044124.");
  const notFound = () => make("APP_B24_NOT_FOUND", "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E: \u0442\u0430\u043A\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u043D\u0435\u0442 \u0438\u043B\u0438 \u043E\u043D \u0443\u0434\u0430\u043B\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043D\u043E\u043C\u0435\u0440.");
  const badRequest = () => {
    const fields = input.fields && input.fields.length > 0 ? `: ${input.fields.join(", ")}` : "";
    return make("APP_B24_BAD_REQUEST", `\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0437\u0430\u043F\u0440\u043E\u0441\u0430${fields}. \u0418\u0441\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043A\u043E\u043C\u0430\u043D\u0434\u044B.`);
  };
  if (upper === "OVERLOAD_LIMIT") {
    return make("APP_B24_BLOCKED", "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u043A \u043F\u043E\u0440\u0442\u0430\u043B\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C \u0431\u0435\u0441\u043F\u043E\u043B\u0435\u0437\u043D\u043E \u2014 \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u0432 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0443 \u0411\u0438\u0442\u0440\u0438\u043A\u044124.");
  }
  if (upper === "QUERY_LIMIT_EXCEEDED") {
    return make("APP_B24_RATE_LIMITED", "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u0447\u0430\u0441\u0442\u043E\u0442\u0443 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0435\u043A\u0443\u043D\u0434.");
  }
  if (upper === "OPERATION_TIME_LIMIT") {
    return make(
      "APP_B24_METHOD_TIME_LIMIT",
      `\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u043B \u044D\u0442\u043E\u0442 \u0440\u0430\u0437\u0434\u0435\u043B \u0438\u0437-\u0437\u0430 \u043E\u0431\u044A\u0451\u043C\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 ${resetTime(input.operatingResetAt)}.`
    );
  }
  if (upper === "ACCESS_DENIED" && input.status === 401) {
    return make(
      "APP_B24_REST_UNAVAILABLE",
      "\u041D\u0430 \u0442\u0430\u0440\u0438\u0444\u0435 \u043F\u043E\u0440\u0442\u0430\u043B\u0430 \u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D REST API \u2014 \u0441\u043A\u0438\u043B\u043B \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442. \u041D\u0443\u0436\u0435\u043D \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0439 \u0442\u0430\u0440\u0438\u0444."
    );
  }
  if (upper === "INSUFFICIENT_SCOPE" || upper.includes("INSUFFICIENTSCOPE")) {
    const scope = scopeForMethod(input.method) ?? "\u043D\u0443\u0436\u043D\u043E\u0435 \u043F\u0440\u0430\u0432\u043E";
    const section = SCOPE_SECTIONS[scope] ?? input.method;
    return make(
      "APP_B24_SCOPE_MISSING",
      `\u0423 \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u043D\u0435\u0442 \u043F\u0440\u0430\u0432\u0430 \xAB${scope}\xBB \u2014 \u0440\u0430\u0437\u0434\u0435\u043B \xAB${section}\xBB \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u0440\u0430\u0432\u043E \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0432\u0435\u0431\u0445\u0443\u043A\u0430.`
    );
  }
  if (AUTH_CODES.has(upper) || input.status === 401) {
    return make(
      "APP_B24_AUTH_FAILED",
      "\u041F\u043E\u0440\u0442\u0430\u043B \u043D\u0435 \u043F\u0440\u0438\u043D\u044F\u043B \u043A\u043B\u044E\u0447 \u0434\u043E\u0441\u0442\u0443\u043F\u0430: \u0432\u0435\u0431\u0445\u0443\u043A \u0443\u0434\u0430\u043B\u0451\u043D, \u0443 \u043D\u0435\u0433\u043E \u0438\u0441\u0442\u0451\u043A \u0441\u0440\u043E\u043A \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0441\u044F \u043A\u043E\u0434. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u044B\u0439 \u0432\u0435\u0431\u0445\u0443\u043A \u0438 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0432 \u0444\u0430\u0439\u043B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A."
    );
  }
  if (upper === "ERROR_METHOD_NOT_FOUND") {
    return make(
      "APP_B24_METHOD_UNAVAILABLE",
      "\u041C\u0435\u0442\u043E\u0434 \u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D: \u0443 \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u043D\u0435\u0442 \u043D\u0443\u0436\u043D\u043E\u0433\u043E \u043F\u0440\u0430\u0432\u0430 \u0438\u043B\u0438 \u043F\u043E\u0440\u0442\u0430\u043B \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u044D\u0442\u043E\u0442 \u0440\u0430\u0437\u0434\u0435\u043B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0440\u0430\u0432\u0430 \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u043E\u0439 status."
    );
  }
  if (upper.includes("ACCESS_DENIED") || upper === "ACCESS_ERROR" || upper.includes("ACCESSDENIED")) {
    return accessDenied();
  }
  if (upper.includes("NOT_FOUND") || upper.includes("NOTFOUND")) {
    return notFound();
  }
  if (isBadRequestCode(upper)) {
    return badRequest();
  }
  if (/not\s*found|не\s*найден/i.test(description)) {
    return notFound();
  }
  if (/access\s*denied|нет\s*доступа|доступ\s*запрещ/i.test(description)) {
    return accessDenied();
  }
  if (input.status === 403) {
    return accessDenied();
  }
  if (input.status === 404) {
    return notFound();
  }
  if (input.status === 400) {
    return badRequest();
  }
  return make("APP_B24_PORTAL_ERROR", "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0435\u0440\u043D\u0443\u043B \u043E\u0448\u0438\u0431\u043A\u0443 \u043F\u0440\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438 \u0437\u0430\u043F\u0440\u043E\u0441\u0430. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.");
}

// src/api/client.ts
function isDownloadPath(pathname, webhook) {
  return pathname === "/rest/download.json" || pathname === `/rest/${webhook.userId}/${webhook.code}/download/`;
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function operatingResetAt(body) {
  const time = body.time;
  return isObject(time) && typeof time.operating_reset_at === "number" ? time.operating_reset_at : void 0;
}
function unexpected(method, status2) {
  return new AppError({
    code: "APP_B24_UNEXPECTED_RESPONSE",
    userMessage: "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0435\u0440\u043D\u0443\u043B \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u043E\u043C \u0432\u0438\u0434\u0435 \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0438\u0445 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C.",
    details: { method, status: status2 }
  });
}
function portalError(method, status2) {
  return new AppError({
    code: "APP_B24_PORTAL_ERROR",
    userMessage: "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0435\u0440\u043D\u0443\u043B \u043E\u0448\u0438\u0431\u043A\u0443 \u043F\u0440\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438 \u0437\u0430\u043F\u0440\u043E\u0441\u0430. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.",
    details: { method, status: status2 }
  });
}
function transportError(err, method) {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new AppError({
      code: "APP_B24_TIMEOUT",
      userMessage: "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441 \u0438\u043B\u0438 \u0443\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u0435 \u043E\u0431\u044A\u0451\u043C (--limit).",
      details: { method },
      cause: err
    });
  }
  return new AppError({
    code: "APP_B24_NETWORK",
    userMessage: "\u041D\u0435\u0442 \u0441\u0432\u044F\u0437\u0438 \u0441 \u043F\u043E\u0440\u0442\u0430\u043B\u043E\u043C \u0411\u0438\u0442\u0440\u0438\u043A\u044124. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442 \u0438 \u0430\u0434\u0440\u0435\u0441 \u043F\u043E\u0440\u0442\u0430\u043B\u0430.",
    details: { method },
    cause: err
  });
}
function notAllowed(method) {
  return new AppError({
    code: "APP_B24_METHOD_NOT_ALLOWED",
    userMessage: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043F\u043E\u043F\u044B\u0442\u0430\u043B\u0430\u0441\u044C \u0432\u044B\u0437\u0432\u0430\u0442\u044C \u043C\u0435\u0442\u043E\u0434, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u044D\u0442\u043E\u0442 \u0441\u043A\u0438\u043B\u043B \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442; \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D.",
    details: { method }
  });
}
async function placeWithoutOverwrite(tmpPath, destPath, fail) {
  try {
    await import_node_fs.default.promises.link(tmpPath, destPath);
    return;
  } catch (err) {
    const code = err.code;
    if (code === "EEXIST") {
      throw fail("dest-exists", err);
    }
    if (code !== "EPERM" && code !== "ENOTSUP" && code !== "EXDEV" && code !== "EOPNOTSUPP") {
      throw fail("io", err);
    }
  }
  try {
    await import_node_fs.default.promises.copyFile(tmpPath, destPath, import_node_fs.default.constants.COPYFILE_EXCL);
  } catch (err) {
    throw fail(err.code === "EEXIST" ? "dest-exists" : "io", err);
  }
}
var B24Client = class {
  webhook;
  fetchFn;
  now;
  sleep;
  timeoutMs;
  idleTimeoutMs;
  minIntervalMs;
  lastRequestAt = null;
  // Время сброса лимита по времени метода из последнего успешного ответа:
  // документация советует ориентироваться на него (error-codes.md).
  lastOperatingResetAt;
  constructor(options) {
    this.webhook = options.webhook;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DOWNLOAD_IDLE_TIMEOUT_MS;
    this.minIntervalMs = options.minIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
  }
  async call(method, params = {}) {
    if (!ALLOWED_V1.has(method) || !isReadOnlyShape(method)) {
      throw notAllowed(method);
    }
    const { origin, userId, code } = this.webhook;
    const { status: status2, body } = await this.post(`${origin}/rest/${userId}/${code}/${method}.json`, params, method);
    if ("error" in body && !isObject(body.error)) {
      throw mapBitrixError({
        code: String(body.error ?? ""),
        status: status2,
        method,
        description: typeof body.error_description === "string" ? body.error_description : void 0,
        operatingResetAt: operatingResetAt(body) ?? this.lastOperatingResetAt
      });
    }
    if (status2 >= 400 || !("result" in body)) {
      throw status2 >= 500 ? portalError(method, status2) : unexpected(method, status2);
    }
    const response = { result: body.result };
    if (typeof body.next === "number") {
      response.next = body.next;
    }
    if (typeof body.total === "number") {
      response.total = body.total;
    }
    return response;
  }
  async callV3(method, payload = {}) {
    if (!ALLOWED_V3.has(method) || !isReadOnlyShape(method)) {
      throw notAllowed(method);
    }
    const { origin, userId, code } = this.webhook;
    const { status: status2, body } = await this.post(`${origin}/rest/api/${userId}/${code}/${method}`, payload, method);
    if ("error" in body) {
      const error = isObject(body.error) ? body.error : { code: body.error, message: body.error_description };
      const validation = Array.isArray(error.validation) ? error.validation : [];
      const fields = validation.map((item) => isObject(item) && typeof item.field === "string" ? item.field : void 0).filter((field) => field !== void 0);
      throw mapBitrixError({
        code: String(error.code ?? ""),
        status: status2,
        method,
        description: typeof error.message === "string" ? error.message : void 0,
        fields,
        operatingResetAt: operatingResetAt(body) ?? this.lastOperatingResetAt
      });
    }
    if (status2 >= 400 || !("result" in body)) {
      throw status2 >= 500 ? portalError(method, status2) : unexpected(method, status2);
    }
    return body.result;
  }
  async download(url, destPath, expectedSize, maxBytes) {
    const name = import_node_path2.default.basename(destPath);
    const fail = (reason, cause) => new AppError({
      code: "APP_B24_DOWNLOAD_FAILED",
      userMessage: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B \xAB${name}\xBB. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.`,
      details: { reason },
      cause
    });
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw fail("bad-url");
    }
    if (parsed.origin !== this.webhook.origin) {
      throw fail("foreign-host");
    }
    if (!isDownloadPath(parsed.pathname, this.webhook)) {
      throw fail("not-a-download-link");
    }
    await this.pace();
    const tmpPath = `${destPath}.part-${process.pid}-${import_node_crypto.default.randomBytes(4).toString("hex")}`;
    const controller = new AbortController();
    const responseTimer = setTimeout(
      () => controller.abort(new DOMException("response timeout", "TimeoutError")),
      this.timeoutMs
    );
    let handle;
    try {
      let response;
      try {
        response = await this.fetchFn(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "*/*",
            "Accept-Language": "ru-RU,ru;q=0.9",
            Referer: `${this.webhook.origin}/`
          },
          signal: controller.signal
        });
      } catch (err) {
        throw fail("transport", err);
      } finally {
        clearTimeout(responseTimer);
      }
      const finalUrl = response.url === "" ? url : response.url;
      if (new URL(finalUrl).origin !== this.webhook.origin) {
        void response.body?.cancel().catch(() => void 0);
        throw fail("redirect-foreign-host");
      }
      if (response.status !== 200 || !response.body) {
        void response.body?.cancel().catch(() => void 0);
        throw fail(`status-${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (/text\/html/i.test(contentType) && !/\.html?$/i.test(name)) {
        void response.body.cancel().catch(() => void 0);
        throw fail("html-instead-of-file");
      }
      handle = await import_node_fs.default.promises.open(tmpPath, "wx");
      const reader = response.body.getReader();
      let bytes = 0;
      for (; ; ) {
        const chunk = await this.readWithIdleTimeout(reader, controller, fail);
        if (chunk.done) {
          break;
        }
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes || bytes > expectedSize) {
          void reader.cancel().catch(() => void 0);
          throw fail(bytes > maxBytes ? "over-limit" : "more-than-expected");
        }
        await handle.write(chunk.value);
      }
      await handle.close();
      handle = void 0;
      const written = (await import_node_fs.default.promises.stat(tmpPath)).size;
      if (bytes !== expectedSize || written !== expectedSize) {
        throw fail(`size-mismatch-${written}-of-${expectedSize}`);
      }
      await placeWithoutOverwrite(tmpPath, destPath, fail);
      await import_node_fs.default.promises.rm(tmpPath, { force: true });
      return { path: destPath, size: written };
    } catch (err) {
      await handle?.close().catch(() => void 0);
      await import_node_fs.default.promises.rm(tmpPath, { force: true }).catch(() => void 0);
      throw err instanceof AppError ? err : fail("io", err);
    }
  }
  readWithIdleTimeout(reader, controller, fail) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controller.abort(new DOMException("idle timeout", "TimeoutError"));
        void reader.cancel().catch(() => void 0);
        reject(fail("idle-timeout"));
      }, this.idleTimeoutMs);
      reader.read().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }
  async post(url, payload, method) {
    await this.pace();
    let response;
    let text;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify(payload),
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      text = await response.text();
    } catch (err) {
      throw transportError(err, method);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new AppError({
        code: "APP_B24_PORTAL_MOVED",
        userMessage: "\u041F\u043E\u0440\u0442\u0430\u043B \u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u043F\u0435\u0440\u0435\u0430\u0434\u0440\u0435\u0441\u0443\u0435\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u0430\u0434\u0440\u0435\u0441 \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043F\u043E\u0440\u0442\u0430\u043B \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0432\u0435\u0431\u0445\u0443\u043A \u0437\u0430\u043D\u043E\u0432\u043E \u0438 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0432 \u0444\u0430\u0439\u043B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A.",
        details: { method, status: response.status }
      });
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw response.status >= 500 ? portalError(method, response.status) : unexpected(method, response.status);
    }
    if (!isObject(body)) {
      throw unexpected(method, response.status);
    }
    const resetAt = operatingResetAt(body);
    if (resetAt !== void 0 && !("error" in body)) {
      this.lastOperatingResetAt = resetAt;
    }
    return { status: response.status, body };
  }
  // Слот резервируется синхронно, до ожидания: при параллельных вызовах каждый
  // следующий встаёт через интервал после предыдущего, а не все сразу.
  async pace() {
    const now = this.now();
    const start = this.lastRequestAt === null ? now : Math.max(now, this.lastRequestAt + this.minIntervalMs);
    this.lastRequestAt = start;
    if (start > now) {
      await this.sleep(start - now);
    }
  }
};

// src/api/redact.ts
var HIDDEN = "<\u0441\u043A\u0440\u044B\u0442\u043E>";
var SECRET_PARAM_RE = /((?:auth(?:\[auth\]|%5Bauth%5D)?|token|signature|_esd)=)([^&\s"'<>]+)/gi;
function redact(text, secrets) {
  let out = text;
  for (const secret of secrets) {
    const value = secret.trim();
    if (value === "") {
      continue;
    }
    out = out.split(value).join(HIDDEN);
  }
  return out.replace(SECRET_PARAM_RE, `$1${HIDDEN}`);
}

// src/config/webhook.ts
var WEBHOOK_PATH_RE = /^\/rest\/(\d+)\/([A-Za-z0-9]+)\/?$/;
var WRAPPING_QUOTES_RE = /^(['"])(.*)\1$/s;
function invalid() {
  return new AppError({
    code: "APP_B24_WEBHOOK_INVALID",
    userMessage: "\u0410\u0434\u0440\u0435\u0441 \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u0443\u043A\u0430\u0437\u0430\u043D \u043D\u0435\u0432\u0435\u0440\u043D\u043E: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0432\u0438\u0434 https://\u043F\u043E\u0440\u0442\u0430\u043B/rest/\u043D\u043E\u043C\u0435\u0440/\u043A\u043E\u0434/. \u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0438\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u0437\u0430\u043D\u043E\u0432\u043E."
  });
}
function parseWebhook(raw) {
  const trimmed = (raw ?? "").trim();
  const unquoted = trimmed.replace(WRAPPING_QUOTES_RE, "$2").trim();
  if (unquoted === "") {
    throw new AppError({
      code: "APP_B24_WEBHOOK_MISSING",
      userMessage: `\u041D\u0435 \u0437\u0430\u0434\u0430\u043D \u0430\u0434\u0440\u0435\u0441 \u0432\u0435\u0431\u0445\u0443\u043A\u0430 \u0411\u0438\u0442\u0440\u0438\u043A\u044124. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0432\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0432\u0435\u0431\u0445\u0443\u043A \u0438 \u0432\u043F\u0438\u0448\u0438\u0442\u0435 \u0435\u0433\u043E \u0432 ${ENV_PATH_DISPLAY} \u0432 \u0441\u0442\u0440\u043E\u043A\u0443 ${WEBHOOK_ENV}=.`
    });
  }
  let url;
  try {
    url = new URL(unquoted);
  } catch {
    throw invalid();
  }
  if (url.protocol !== "https:" || url.search !== "" || url.hash !== "" || url.username !== "" || url.password !== "") {
    throw invalid();
  }
  const match = WEBHOOK_PATH_RE.exec(url.pathname);
  if (!match) {
    throw invalid();
  }
  const userId = Number(match[1]);
  const code = match[2];
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw invalid();
  }
  return { origin: url.origin, userId, code };
}

// src/render/dates.ts
var pad = (n, width = 2) => String(Math.abs(n)).padStart(width, "0");
var HOUR_MS = 36e5;
function zoneParts(epochMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(epochMs));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}
function offsetMinutes(epochMs, tz) {
  const p = zoneParts(epochMs, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(epochMs / 1e3) * 1e3) / 6e4);
}
function formatOffset(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}
function wall(y, m, d, h, mi, s) {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}
function formatInZone(epochMs, tz) {
  const p = zoneParts(epochMs, tz);
  return `${wall(p.y, p.m, p.d, p.h, p.mi, p.s)}${formatOffset(offsetMinutes(epochMs, tz))}`;
}
function localDateKey(epochMs, tz) {
  const p = zoneParts(epochMs, tz);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}
function wallTimeToEpoch(y, m, d, h, mi, s, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const offsets = new Set([-24, -12, 0, 12, 24].map((shift) => offsetMinutes(guess + shift * HOUR_MS, tz)));
  const target = wall(y, m, d, h, mi, s);
  const hits = [...offsets].map((off) => guess - off * 6e4).filter((epoch) => {
    const p = zoneParts(epoch, tz);
    return wall(p.y, p.m, p.d, p.h, p.mi, p.s) === target;
  });
  return hits.length > 0 ? Math.min(...hits) : null;
}
function startOfDay(y, m, d, tz) {
  const exact = wallTimeToEpoch(y, m, d, 0, 0, 0, tz);
  if (exact !== null) {
    return exact;
  }
  const day = `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
  const guess = Date.UTC(y, m - 1, d);
  let lo = guess - 14 * HOUR_MS;
  let hi = guess + 14 * HOUR_MS;
  while (hi - lo > 1e3) {
    const mid = lo + Math.floor((hi - lo) / 2e3) * 1e3;
    if (localDateKey(mid, tz) >= day) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}
function machineTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
function checkCalendarDay(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
var DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
var LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
var ZONED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
function invalidDate(option, raw) {
  return new AppError({
    code: "APP_CLI_INVALID_ARGUMENT",
    userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 ${option}: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u0434\u0430\u0442\u0430 \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414 \u0438\u043B\u0438 \u0434\u0430\u0442\u0430 \u0441\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414T\u0447\u0447:\u043C\u043C, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${raw}\xBB.`
  });
}
function nextDay(y, m, d) {
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
}
function parseInputDate(raw, edge, option, tz = machineTimeZone()) {
  const value = raw.trim();
  const dateOnly = DATE_ONLY_RE.exec(value);
  if (dateOnly) {
    const [y, m, d] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    if (!checkCalendarDay(y, m, d)) {
      throw invalidDate(option, raw);
    }
    const epoch = edge === "start" ? startOfDay(y, m, d, tz) : startOfDay(...nextDay(y, m, d), tz) - 1e3;
    return formatInZone(epoch, tz);
  }
  const local = LOCAL_DATETIME_RE.exec(value);
  if (local) {
    const [y, m, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(local[i] ?? 0));
    if (!checkCalendarDay(y, m, d) || h > 23 || mi > 59 || s > 59) {
      throw invalidDate(option, raw);
    }
    const epoch = wallTimeToEpoch(y, m, d, h, mi, s, tz);
    if (epoch === null) {
      throw invalidDate(option, raw);
    }
    return formatInZone(epoch, tz);
  }
  if (ZONED_DATETIME_RE.test(value)) {
    const epoch = Date.parse(value);
    const day = value.slice(0, 10).split("-").map(Number);
    if (!Number.isFinite(epoch) || !checkCalendarDay(...day)) {
      throw invalidDate(option, raw);
    }
    return formatInZone(epoch, tz);
  }
  throw invalidDate(option, raw);
}

// src/render/output.ts
var REDACTED_NOTE = "\u0412 \u0442\u0435\u043A\u0441\u0442\u0435 \u0441\u043A\u0440\u044B\u0442\u044B \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F, \u043F\u043E\u0445\u043E\u0436\u0438\u0435 \u043D\u0430 \u043A\u043B\u044E\u0447\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 (token=, auth= \u0438 \u0442. \u043F.).";
function redactLeaves(value, onChange) {
  if (typeof value === "string") {
    const cleaned = redact(value, []);
    if (cleaned !== value) {
      onChange();
    }
    return cleaned;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLeaves(item, onChange));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactLeaves(item, onChange)]));
  }
  return value;
}
function finalizeOutput(envelope2, secrets) {
  const raw = JSON.stringify(envelope2);
  if (secrets.some((secret) => secret.trim() !== "" && raw.includes(secret.trim()))) {
    throw new AppError({
      code: "APP_B24_SECRET_IN_OUTPUT",
      userMessage: "\u041E\u0442\u0432\u0435\u0442 \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D: \u0432 \u043D\u0451\u043C \u043E\u043A\u0430\u0437\u0430\u043B\u0441\u044F \u0430\u0434\u0440\u0435\u0441 \u0432\u0430\u0448\u0435\u0433\u043E \u0432\u0435\u0431\u0445\u0443\u043A\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0435\u0433\u043E \u0432\u0441\u0442\u0430\u0432\u0438\u043B\u0438 \u0432 \u0447\u0430\u0442 \u0438\u043B\u0438 \u043F\u0438\u0441\u044C\u043C\u043E). \u0423\u0434\u0430\u043B\u0438\u0442\u0435 \u044D\u0442\u043E\u0442 \u0432\u0435\u0431\u0445\u0443\u043A \u0432 \u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u044B\u0439."
    });
  }
  let changed = false;
  const cleaned = redactLeaves(envelope2, () => {
    changed = true;
  });
  if (changed) {
    cleaned.notes = [...cleaned.notes, REDACTED_NOTE];
  }
  return JSON.stringify(cleaned, null, 2);
}

// src/cli/runtime.ts
function bootstrapEnv(envPath = ENV_PATH, env = process.env) {
  let content;
  try {
    content = import_node_fs2.default.readFileSync(envPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return;
    }
    throw new AppError({
      code: "APP_B24_CONFIG_UNREADABLE",
      userMessage: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A ${ENV_PATH_DISPLAY}: \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E \u044D\u0442\u043E \u0444\u0430\u0439\u043B \u0438 \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u043F\u0440\u0430\u0432\u0430 \u043D\u0430 \u0447\u0442\u0435\u043D\u0438\u0435.`,
      cause: err
    });
  }
  const value = import_dotenv.default.parse(content)[WEBHOOK_ENV];
  if (value !== void 0 && !env[WEBHOOK_ENV]) {
    env[WEBHOOK_ENV] = value;
  }
}
function loadWebhook(env = process.env) {
  return parseWebhook(env[WEBHOOK_ENV]);
}
function secretsFromEnv(env = process.env) {
  const raw = env[WEBHOOK_ENV]?.trim();
  if (!raw) {
    return [];
  }
  const secrets = [raw];
  try {
    secrets.push(parseWebhook(raw).code);
  } catch {
  }
  return secrets;
}
function isDebug(env = process.env) {
  return ["1", "true", "yes", "on"].includes((env[DEBUG_ENV] ?? "").trim().toLowerCase());
}
var MAX_CAUSE_DEPTH = 4;
function describeCauses(err) {
  const lines = [];
  let current = err instanceof AppError ? err.cause : err;
  for (let depth = 0; current !== void 0 && current !== null && depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current instanceof Error) {
      const code = current.code;
      lines.push(`\u041F\u0440\u0438\u0447\u0438\u043D\u0430: ${current.name}: ${current.message}${code ? ` (${code})` : ""}`);
      current = current.cause;
    } else {
      lines.push(`\u041F\u0440\u0438\u0447\u0438\u043D\u0430: ${String(current)}`);
      current = void 0;
    }
  }
  return lines;
}
function formatError(err, secrets, debug) {
  const lines = err instanceof AppError ? [`\u041E\u0448\u0438\u0431\u043A\u0430: ${err.userMessage} [${err.code}]`] : [`\u041E\u0448\u0438\u0431\u043A\u0430: \u041D\u0435\u043F\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043D\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0441 ${DEBUG_ENV}=1, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438. [APP_UNEXPECTED]`];
  if (debug) {
    if (err instanceof AppError && err.details !== void 0) {
      lines.push(`\u0414\u0435\u0442\u0430\u043B\u0438: ${JSON.stringify(err.details)}`);
    }
    lines.push(...describeCauses(err));
  }
  return lines.map((line) => redact(line, secrets));
}
function reportError(err, secrets = secretsFromEnv()) {
  for (const line of formatError(err, secrets, isDebug())) {
    console.error(line);
  }
  process.exitCode = 1;
}
var DECIMAL_INT_RE = /^\d+$/;
function parsePositiveInt(raw, optionName, max) {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  const withinMax = max === void 0 || value <= max;
  if (!DECIMAL_INT_RE.test(trimmed) || !Number.isSafeInteger(value) || value <= 0 || !withinMax) {
    const range = max === void 0 ? "\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0446\u0435\u043B\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C" : `\u0446\u0435\u043B\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u043E\u0442 1 \u0434\u043E ${max}`;
    throw new AppError({
      code: "APP_CLI_INVALID_ARGUMENT",
      userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 ${optionName}: \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C ${range}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${raw}\xBB.`
    });
  }
  return value;
}
var runCommand = async (fn) => {
  const webhook = loadWebhook();
  const client = new B24Client({ webhook });
  const result = await fn({ client, webhook, tz: machineTimeZone() });
  process.stdout.write(`${finalizeOutput(result, secretsFromEnv())}
`);
};

// src/render/dialog-id.ts
var PRIVATE_TYPES = /* @__PURE__ */ new Set(["user", "private", "bot"]);
function normalizeDialogId(raw, type) {
  const value = String(raw).trim();
  if (/^(?:chat|sg)\d+$/.test(value)) {
    return value;
  }
  const user = /^user(\d+)$/.exec(value);
  if (user) {
    return user[1];
  }
  if (/^\d+$/.test(value) && type !== void 0) {
    return PRIVATE_TYPES.has(type) ? value : `chat${value}`;
  }
  throw new AppError({
    code: "APP_B24_UNEXPECTED_RESPONSE",
    userMessage: "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0435\u0440\u043D\u0443\u043B \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u043E\u043C \u0432\u0438\u0434\u0435 \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0438\u0445 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C.",
    details: { field: "dialogId", type }
  });
}
function parseDialogIdArg(raw) {
  const value = raw.trim();
  if (/^(?:chat|sg)\d+$/.test(value) || /^\d+$/.test(value)) {
    return value;
  }
  throw new AppError({
    code: "APP_CLI_INVALID_ARGUMENT",
    userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 dialogId: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F chat<\u043D\u043E\u043C\u0435\u0440>, sg<\u043D\u043E\u043C\u0435\u0440 \u043F\u0440\u043E\u0435\u043A\u0442\u0430> \u0438\u043B\u0438 \u043D\u043E\u043C\u0435\u0440 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u0434\u043B\u044F \u043B\u0438\u0447\u043A\u0438, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${raw}\xBB.`
  });
}

// src/render/text.ts
var KNOWN_TAGS = [
  "B",
  "I",
  "U",
  "S",
  "COLOR",
  "SIZE",
  "FONT",
  "ICON",
  "LEFT",
  "RIGHT",
  "CENTER",
  "JUSTIFY",
  "IMG",
  "VIDEO",
  "SPOILER",
  "P",
  "HR",
  "PCH",
  "ATTACH",
  "DISK",
  "CONTEXT",
  "SEND",
  "PUT",
  "CALL",
  "CHAT",
  "LIKE",
  "DATE",
  "BOT"
];
var KNOWN_TAG_RE = new RegExp(`\\[\\/?(?:${KNOWN_TAGS.join("|")})(?:=[^\\]]*)?(?:\\s[^\\]]*)?\\]`, "gi");
var ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#039;": "'",
  "&nbsp;": " "
};
var CODE_BLOCK_RE = /\[CODE\]([\s\S]*?)\[\/CODE\]/gi;
var SYSTEM_CODES = /* @__PURE__ */ new Set(["CHAT_JOIN", "CHAT_LEAVE", "CHAT_CREATE", "CHAT_RENAME", "CHAT_AVATAR"]);
function flattenListsAndTables(text) {
  return text.replace(/\[LIST(?:=[^\]]*)?\]\s*/gi, "").replace(/\s*\[\/LIST\]/gi, "").replace(/\s*\[\*\]\s*/g, "\n- ").replace(/\[\/T[DH]\]\s*\[T[DH](?:=[^\]]*)?\]/gi, " | ").replace(/\[\/?T[DH](?:=[^\]]*)?\]/gi, "").replace(/\s*\[\/TR\]\s*\[TR\]\s*/gi, "\n").replace(/\[\/?(?:TR|TABLE)\]/gi, "").replace(/^\n+/, "");
}
function bbToText(raw, users = /* @__PURE__ */ new Map(), tz = machineTimeZone()) {
  const codeBlocks = [];
  let text = raw.replace(CODE_BLOCK_RE, (_m, body) => {
    codeBlocks.push(body);
    return `\uE000${codeBlocks.length - 1}\uE000`;
  });
  text = text.replace(/\[br\]/gi, "\n");
  text = text.replace(/\[TIMESTAMP=(\d+)(?:\s[^\]]*)?\]/gi, (_m, ts) => formatInZone(Number(ts) * 1e3, tz));
  text = flattenListsAndTables(text);
  text = text.replace(/\[USER=(\d+)(?:\s+REPLACE)?\]([\s\S]*?)\[\/USER\]/gi, (_m, id, name) => {
    const shown = name.trim() !== "" ? name.trim() : users.get(Number(id)) ?? `\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A ${id}`;
    return `@${shown}`;
  });
  text = text.replace(/\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]/gi, (_m, href, label) => {
    const l = label.trim();
    return l === "" || l === href ? href : `${l} (${href})`;
  });
  text = text.replace(/\[URL\]([\s\S]*?)\[\/URL\]/gi, (_m, href) => href.trim());
  text = text.replace(
    /\[QUOTE\]([\s\S]*?)\[\/QUOTE\]\n?/gi,
    (_m, body) => body.trim().split("\n").map((line) => `> ${line}`).join("\n").concat("\n")
  );
  text = text.replace(KNOWN_TAG_RE, "");
  text = text.replace(/\[\/?(?:USER|URL|QUOTE)(?:=[^\]]*)?(?:\s[^\]]*)?\]/gi, "");
  text = text.replace(/&(?:amp|lt|gt|quot|nbsp|#0?39);/g, (entity) => ENTITIES[entity] ?? entity);
  text = text.replace(/\uE000(\d+)\uE000/g, (match, i) => codeBlocks[Number(i)] ?? match);
  return text.replace(/\n$/, "");
}
function isSystemMessage(msg) {
  return msg.authorId === 0 || msg.code !== void 0 && SYSTEM_CODES.has(msg.code);
}
function truncate(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) {
    return { text, truncated: false };
  }
  return { text: chars.slice(0, max).join(""), truncated: true };
}

// src/commands/common.ts
function envelope(data, next = null, notes = []) {
  return { data, next, notes };
}
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return isObject2(value) ? Object.values(value) : [];
}
function str(value) {
  return typeof value === "string" ? value : value === null || value === void 0 ? "" : String(value);
}
function num(value) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
function parseLimit(raw, def, max, option = "--limit") {
  return raw === void 0 ? def : parsePositiveInt(raw, option, max);
}
function parseId(raw, option) {
  return parsePositiveInt(raw, option);
}
function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function decodeCursor(raw, option, check) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(raw.trim(), "base64url").toString("utf8"));
  } catch {
    parsed = void 0;
  }
  if (!check(parsed)) {
    throw new AppError({
      code: "APP_CLI_INVALID_ARGUMENT",
      userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 ${option}: \u043A\u0443\u0440\u0441\u043E\u0440 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D. \u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044F next \u0438\u0437 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \u043A\u0430\u043A \u0435\u0441\u0442\u044C.`
    });
  }
  return parsed;
}
function personName(raw) {
  const full = str(raw.name ?? raw.NAME_FORMATTED ?? raw.FULL_NAME).trim();
  if (full !== "" && raw.NAME === void 0) {
    return full;
  }
  const first = str(raw.NAME ?? raw.first_name ?? raw.firstName).trim();
  const last = str(raw.LAST_NAME ?? raw.last_name ?? raw.lastName).trim();
  const joined = `${first} ${last}`.trim();
  return joined !== "" ? joined : full;
}
function peopleMap(users) {
  const map = /* @__PURE__ */ new Map();
  for (const item of asArray(users)) {
    if (isObject2(item)) {
      const id = num(item.id ?? item.ID);
      if (id !== null) {
        map.set(id, personName(item));
      }
    }
  }
  return map;
}
function unexpected2(field) {
  return new AppError({
    code: "APP_B24_UNEXPECTED_RESPONSE",
    userMessage: "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0432\u0435\u0440\u043D\u0443\u043B \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u043E\u043C \u0432\u0438\u0434\u0435 \u2014 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0438\u0445 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C.",
    details: { field }
  });
}

// src/commands/messages.ts
function toMessages(result, tz, full) {
  const users = peopleMap(result.users);
  const files = /* @__PURE__ */ new Map();
  for (const f of asArray(result.files).filter(isObject2)) {
    const id = num(f.id);
    if (id !== null) {
      files.set(id, { fileId: id, name: str(f.name), size: num(f.size), type: str(f.type) });
    }
  }
  const out = [];
  for (const m of asArray(result.messages).filter(isObject2)) {
    const id = num(m.id);
    if (id === null) {
      continue;
    }
    const authorId = num(m.author_id ?? m.authorId) ?? 0;
    const params = isObject2(m.params) ? m.params : {};
    const code = str(params.CODE) || void 0;
    const system = m.isSystem === true || isSystemMessage({ authorId, code });
    const text = bbToText(str(m.text), users, tz);
    const cut = full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
    const fileIds = asArray(params.FILE_ID ?? m.files).map((f) => num(isObject2(f) ? f.id : f)).filter((f) => f !== null);
    out.push({
      id,
      date: str(m.date),
      author: authorId === 0 ? { id: 0, name: "\u0441\u0438\u0441\u0442\u0435\u043C\u0430" } : { id: authorId, name: users.get(authorId) ?? `\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A ${authorId}` },
      text: cut.text,
      ...cut.truncated ? { truncated: true } : {},
      system,
      files: fileIds.map((fid) => files.get(fid) ?? { fileId: fid })
    });
  }
  return out;
}

// src/commands/chats.ts
var PAGE = 50;
var SINCE_CAP = 500;
var LAST_MESSAGE_PREVIEW = 300;
function invalid2(message) {
  return new AppError({ code: "APP_CLI_INVALID_ARGUMENT", userMessage: message });
}
function entityOf(chat) {
  if (!isObject2(chat) || str(chat.entity_type) === "") {
    return null;
  }
  return { type: str(chat.entity_type), id: str(chat.entity_id) };
}
var isOffsetCursor = (v) => isObject2(v) && typeof v.o === "number" && Number.isSafeInteger(v.o) && v.o >= 0;
async function chatsRecent(ctx, opts) {
  const limit = parseLimit(opts.limit, 20, 50);
  const offset = opts.page ? decodeCursor(opts.page, "--page", isOffsetCursor).o : 0;
  const type = opts.type ?? "all";
  if (!["all", "private", "chat"].includes(type)) {
    throw invalid2(`\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 --type: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F private, chat \u0438\u043B\u0438 all, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${type}\xBB.`);
  }
  const params = { SKIP_OPENLINES: "Y", LIMIT: limit, OFFSET: offset };
  if (type === "private") params.SKIP_CHAT = "Y";
  if (type === "chat") params.SKIP_DIALOG = "Y";
  if (opts.unread) params.UNREAD_ONLY = "Y";
  const resp = await ctx.client.call("im.recent.list", params);
  if (!isObject2(resp.result)) {
    throw unexpected2("im.recent.list.result");
  }
  const seen = /* @__PURE__ */ new Set();
  const data = [];
  for (const it of asArray(resp.result.items).filter(isObject2)) {
    const dialogId = normalizeDialogId(str(it.id), str(it.type));
    const unreadCount = num(it.counter) ?? 0;
    if (seen.has(dialogId) || opts.unread && unreadCount === 0) {
      continue;
    }
    seen.add(dialogId);
    const message = isObject2(it.message) ? it.message : null;
    data.push({
      dialogId,
      title: str(it.title),
      type: isObject2(it.chat) && str(it.chat.type) !== "" ? str(it.chat.type) : str(it.type),
      entity: entityOf(it.chat),
      unreadCount,
      markedUnread: it.unread === true,
      lastMessage: message ? { text: truncate(bbToText(str(message.text), /* @__PURE__ */ new Map(), ctx.tz), LAST_MESSAGE_PREVIEW).text, date: str(message.date), authorId: num(message.author_id) } : null,
      date: str(it.date_update ?? it.date_last_activity)
    });
  }
  const hasMore = resp.result.hasMore === true || resp.result.hasMorePages === true;
  const notes = data.length === 0 ? ["\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435."] : [];
  if (hasMore) notes.push("\u0415\u0441\u0442\u044C \u0435\u0449\u0451 \u0434\u0438\u0430\u043B\u043E\u0433\u0438: --page <next>.");
  return envelope(data, hasMore ? encodeCursor({ o: offset + limit }) : null, notes);
}
async function chatsCounters(ctx) {
  const resp = await ctx.client.call("im.counters.get");
  const type = isObject2(resp.result) && isObject2(resp.result.TYPE) ? resp.result.TYPE : null;
  if (!type) {
    throw unexpected2("im.counters.get.TYPE");
  }
  const byType = Object.fromEntries(Object.entries(type).filter(([, v]) => typeof v === "number"));
  return envelope({ total: num(type.ALL), byType });
}
async function chatsFind(ctx, text, limitRaw) {
  const limit = parseLimit(limitRaw, 10, 50);
  if (text.trim().length < 2) {
    throw invalid2("\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u0442\u0435\u043A\u0441\u0442: \u043D\u0443\u0436\u043D\u043E \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
  }
  const resp = await ctx.client.call("im.search.chat.list", { FIND: text.trim(), LIMIT: limit });
  const data = asArray(resp.result).filter(isObject2).map((c) => ({ dialogId: `chat${num(c.id)}`, title: str(c.name), type: str(c.type), entity: entityOf(c), messageCount: num(c.message_count) }));
  const notes = data.length === 0 ? ["\u0427\u0430\u0442\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u0427\u0430\u0442\u044B \u0437\u0430\u0434\u0430\u0447 \u0442\u0430\u043A \u043D\u0435 \u0438\u0449\u0443\u0442\u0441\u044F \u2014 \u0434\u043B\u044F \u043D\u0438\u0445 tasks get."] : [];
  return envelope(data, null, notes);
}
async function chatsInfo(ctx, dialogArg) {
  const dialogId = parseDialogIdArg(dialogArg);
  const d = await ctx.client.call("im.dialog.get", { DIALOG_ID: dialogId });
  if (!isObject2(d.result)) {
    throw unexpected2("im.dialog.get.result");
  }
  const users = await ctx.client.call("im.dialog.users.list", { DIALOG_ID: dialogId, LIMIT: MAX_MEMBERS });
  const members = asArray(users.result).filter(isObject2).slice(0, MAX_MEMBERS).map((u) => ({ id: num(u.id), name: personName(u), position: str(u.work_position) }));
  const total = Math.max(num(d.result.user_counter) ?? 0, users.total ?? 0, members.length);
  return envelope(
    {
      dialogId,
      title: str(d.result.name),
      type: str(d.result.type),
      ownerId: num(d.result.owner),
      entity: entityOf(d.result),
      messageCount: num(d.result.message_count),
      lastMessageId: num(d.result.last_message_id),
      members,
      membersTotal: total
    },
    null,
    total > members.length ? [`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 ${members.length} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u0438\u0437 ${total}.`] : []
  );
}
async function readForward(ctx, dialogId, after, limit, full) {
  const collected = [];
  let cursor = after;
  let hasMore = false;
  while (collected.length < limit) {
    const want = Math.min(PAGE, limit - collected.length);
    const page = await ctx.client.call("im.dialog.messages.get", { DIALOG_ID: dialogId, FIRST_ID: cursor, LIMIT: want });
    const msgs = toMessages(isObject2(page.result) ? page.result : {}, ctx.tz, full).filter((m) => m.id > cursor);
    if (msgs.length === 0) break;
    collected.push(...msgs);
    const maxId = Math.max(...msgs.map((m) => m.id));
    hasMore = msgs.length >= want;
    if (maxId <= cursor) break;
    cursor = maxId;
    if (!hasMore) break;
  }
  const sorted = collected.sort((a, b) => a.id - b.id).slice(0, limit);
  const next = hasMore && sorted.length > 0 ? String(sorted[sorted.length - 1].id) : null;
  return envelope(sorted, next, next ? ["\u0415\u0441\u0442\u044C \u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F: --after <next>."] : []);
}
async function chatsMessages(ctx, dialogArg, opts) {
  const dialogId = parseDialogIdArg(dialogArg);
  const limit = parseLimit(opts.limit, 30, 200);
  if (opts.before && opts.after) {
    throw invalid2("\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B --before \u0438 --after \u0432\u043C\u0435\u0441\u0442\u0435 \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F: \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u043D\u043E \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435.");
  }
  const full = opts.full === true;
  if (opts.after) {
    return readForward(ctx, dialogId, parsePositiveInt(opts.after, "--after"), limit, full);
  }
  const since = opts.since ? Date.parse(parseInputDate(opts.since, "start", "--since", ctx.tz)) : null;
  let cursor;
  if (opts.before) {
    cursor = parsePositiveInt(opts.before, "--before");
  } else {
    const d = await ctx.client.call("im.dialog.get", { DIALOG_ID: dialogId });
    const last = isObject2(d.result) ? num(d.result.last_message_id) : null;
    if (last === null) throw unexpected2("im.dialog.get.last_message_id");
    cursor = last + 1;
  }
  const target = since !== null ? SINCE_CAP : limit;
  const collected = /* @__PURE__ */ new Map();
  let hasMore = false;
  let reachedSince = false;
  while (collected.size < target) {
    const want = Math.min(PAGE, target - collected.size);
    const page = await ctx.client.call("im.dialog.messages.get", { DIALOG_ID: dialogId, LAST_ID: cursor, LIMIT: want });
    const msgs = toMessages(isObject2(page.result) ? page.result : {}, ctx.tz, full).filter((m) => m.id < cursor);
    if (msgs.length === 0) {
      hasMore = false;
      break;
    }
    for (const m of msgs) {
      if (since !== null && Date.parse(m.date) < since) {
        reachedSince = true;
      } else {
        collected.set(m.id, m);
      }
    }
    hasMore = msgs.length >= want;
    cursor = Math.min(...msgs.map((m) => m.id));
    if (reachedSince || !hasMore) break;
  }
  const kept = [...collected.values()].sort((a, b) => b.id - a.id).slice(0, target);
  const more = !reachedSince && (hasMore || collected.size > kept.length) && kept.length > 0;
  const next = more ? String(kept[kept.length - 1].id) : null;
  const notes = [];
  if (kept.length === 0) notes.push("\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u043D\u0435\u0442 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434.");
  if (next && since !== null) notes.push(`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 ${SINCE_CAP} \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u0434\u0430\u0442\u044B; \u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0438\u0435 \u2014 --before <next>.`);
  else if (next) notes.push("\u0415\u0441\u0442\u044C \u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0438\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F: --before <next>.");
  return envelope(kept.reverse(), next, notes);
}
async function chatsSearch(ctx, dialogArg, text, opts) {
  const dialogId = parseDialogIdArg(dialogArg);
  const limit = parseLimit(opts.limit, 30, 200);
  if (text.trim().length <= 2) {
    throw invalid2("\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u0442\u0435\u043A\u0441\u0442: \u043D\u0443\u0436\u043D\u043E \u0431\u043E\u043B\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.");
  }
  const d = await ctx.client.call("im.dialog.get", { DIALOG_ID: dialogId });
  const chatId = isObject2(d.result) ? num(d.result.id) : null;
  if (chatId === null) throw unexpected2("im.dialog.get.id");
  const params = { CHAT_ID: chatId, SEARCH_MESSAGE: text.trim(), LIMIT: limit, ORDER: { ID: "DESC" } };
  if (opts.since) params.DATE_FROM = parseInputDate(opts.since, "start", "--since", ctx.tz);
  if (opts.until) params.DATE_TO = parseInputDate(opts.until, "end", "--until", ctx.tz);
  if (opts.before) params.LAST_ID = parsePositiveInt(opts.before, "--before");
  const resp = await ctx.client.call("im.dialog.messages.search", params);
  const msgs = toMessages(isObject2(resp.result) ? resp.result : {}, ctx.tz, false).sort((a, b) => a.id - b.id);
  const next = msgs.length >= limit ? String(msgs[0].id) : null;
  const notes = msgs.length === 0 ? ["\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E."] : next ? ["\u0415\u0441\u0442\u044C \u0435\u0449\u0451 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F: --before <next>."] : [];
  return envelope(msgs, next, notes);
}

// src/commands/notifications.ts
var isNotifyCursor = (v) => isObject2(v) && typeof v.id === "number" && Number.isSafeInteger(v.id) && (v.t === 1 || v.t === 3);
async function notifications(ctx, opts) {
  const limit = parseLimit(opts.limit, 20, 50);
  const params = { LIMIT: limit };
  if (opts.before) {
    const c = decodeCursor(opts.before, "--before", isNotifyCursor);
    params.LAST_ID = c.id;
    params.LAST_TYPE = c.t;
  }
  const resp = await ctx.client.call("im.notify.get", params);
  const result = isObject2(resp.result) ? resp.result : {};
  const users = peopleMap(result.users);
  const items = asArray(result.notifications).filter(isObject2);
  const data = items.map((n) => {
    const authorId = num(n.author_id) ?? 0;
    return {
      id: num(n.id),
      date: str(n.date),
      from: authorId === 0 ? null : { id: authorId, name: users.get(authorId) ?? `\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A ${authorId}` },
      title: str(n.notify_title),
      text: truncate(bbToText(str(n.text), users, ctx.tz), MAX_TEXT_CHARS).text,
      module: str(n.notify_module),
      read: n.notify_read === "Y" || n.notify_read === true
    };
  });
  const last = items[items.length - 1];
  const next = items.length >= limit && last ? encodeCursor({ id: num(last.id), t: num(last.notify_type) === 1 ? 1 : 3 }) : null;
  const notes = data.length === 0 ? ["\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 \u043D\u0435\u0442."] : next ? ["\u0415\u0441\u0442\u044C \u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0438\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F: --before <next>."] : [];
  return envelope(data, next, notes);
}

// src/cli/register-chats.ts
var DIALOG_HELP = "chat<\u043D\u043E\u043C\u0435\u0440> \u2014 \u0433\u0440\u0443\u043F\u043F\u043E\u0432\u043E\u0439 \u0447\u0430\u0442 \u0438\u043B\u0438 \u0447\u0430\u0442 \u0437\u0430\u0434\u0430\u0447\u0438, sg<\u043D\u043E\u043C\u0435\u0440> \u2014 \u0447\u0430\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u043D\u043E\u043C\u0435\u0440 \u2014 \u043B\u0438\u0447\u043A\u0430 \u0441 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u043C";
function registerChats(program2, run) {
  const chats = program2.command("chats").description("\u0427\u0430\u0442\u044B, \u043B\u0438\u0447\u043A\u0430, \u0447\u0430\u0442\u044B \u0437\u0430\u0434\u0430\u0447 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432");
  chats.command("recent").description("\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0434\u0438\u0430\u043B\u043E\u0433\u0438 \u0441\u043E \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430\u043C\u0438 \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u043E\u0433\u043E").option("--unread", "\u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u044B\u043C\u0438").option("--type <\u0442\u0438\u043F>", "private | chat | all (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E all)").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 20, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").option("--page <\u043A\u0443\u0440\u0441\u043E\u0440>", "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next \u0438\u0437 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430").action((opts) => run((ctx) => chatsRecent(ctx, opts)));
  chats.command("counters").description("\u0421\u0432\u043E\u0434\u043A\u0430 \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u043E \u0442\u0438\u043F\u0430\u043C").action(() => run((ctx) => chatsCounters(ctx)));
  chats.command("find").description("\u041D\u0430\u0439\u0442\u0438 \u0447\u0430\u0442 \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0443 (\u0447\u0430\u0442\u044B \u0437\u0430\u0434\u0430\u0447 \u0442\u0430\u043A \u043D\u0435 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u2014 \u0434\u043B\u044F \u043D\u0438\u0445 tasks get)").argument("<\u0442\u0435\u043A\u0441\u0442>", "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 10, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").action((text, opts) => run((ctx) => chatsFind(ctx, text, opts.limit)));
  chats.command("info").description("\u0427\u0442\u043E \u0437\u0430 \u0447\u0430\u0442 \u0438 \u043A\u0442\u043E \u0432 \u043D\u0451\u043C").argument("<dialogId>", DIALOG_HELP).action((dialogId) => run((ctx) => chatsInfo(ctx, dialogId)));
  chats.command("messages").description("\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443: \u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F, \u043F\u043E \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u0430\u043D\u0438\u044E \u0432\u0440\u0435\u043C\u0435\u043D\u0438").argument("<dialogId>", DIALOG_HELP).option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 30, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 200)").option("--before <id>", "\u0431\u043E\u043B\u0435\u0435 \u0440\u0430\u043D\u043D\u0438\u0435, \u0447\u0435\u043C \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 (\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next)").option("--after <id>", "\u0431\u043E\u043B\u0435\u0435 \u043D\u043E\u0432\u044B\u0435, \u0447\u0435\u043C \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435").option("--since <\u0434\u0430\u0442\u0430>", "\u0432\u0441\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0430\u0442\u044B \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414 (\u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 500)").option("--full", "\u043D\u0435 \u043E\u0431\u0440\u0435\u0437\u0430\u0442\u044C \u0434\u043B\u0438\u043D\u043D\u044B\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F").action(
    (dialogId, opts) => run((ctx) => chatsMessages(ctx, dialogId, opts))
  );
  chats.command("search").description("\u041D\u0430\u0439\u0442\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0432 \u043E\u0434\u043D\u043E\u043C \u0447\u0430\u0442\u0435").argument("<dialogId>", DIALOG_HELP).argument("<\u0442\u0435\u043A\u0441\u0442>", "\u0431\u043E\u043B\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").option("--since <\u0434\u0430\u0442\u0430>", "\u0441 \u0434\u0430\u0442\u044B \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414").option("--until <\u0434\u0430\u0442\u0430>", "\u043F\u043E \u0434\u0430\u0442\u0443 \u0413\u0413\u0413\u0413-\u041C\u041C-\u0414\u0414").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 30, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 200)").option("--before <id>", "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next \u0438\u0437 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430").action(
    (dialogId, text, opts) => run((ctx) => chatsSearch(ctx, dialogId, text, opts))
  );
  program2.command("notifications").description("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F: \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F, \u043F\u043E\u0440\u0443\u0447\u0435\u043D\u0438\u044F, \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 20, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").option("--before <\u043A\u0443\u0440\u0441\u043E\u0440>", "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next \u0438\u0437 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430").action((opts) => run((ctx) => notifications(ctx, opts)));
}

// src/commands/projects.ts
var GROUP_TYPES = ["group", "project", "scrum", "collab"];
var PAGE2 = 50;
var MAX_PAGES = 10;
var ROLE_NAMES = { A: "\u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446", E: "\u043C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440", K: "\u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A", Z: "\u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435" };
var isStartCursor = (v) => isObject2(v) && typeof v.s === "number" && Number.isSafeInteger(v.s) && v.s >= 0;
function pick(obj, camel, upper) {
  return obj[camel] !== void 0 ? obj[camel] : obj[upper];
}
async function myGroupIds(ctx) {
  const resp = await ctx.client.call("sonet_group.user.groups");
  return new Set(asArray(resp.result).filter(isObject2).map((g) => num(g.GROUP_ID)).filter((id) => id !== null));
}
async function projectsList(ctx, opts) {
  const limit = parseLimit(opts.limit, 20, 50);
  if (opts.type && !GROUP_TYPES.includes(opts.type)) {
    throw new AppError({ code: "APP_CLI_INVALID_ARGUMENT", userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 --type: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F ${GROUP_TYPES.join(" | ")}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${opts.type}\xBB.` });
  }
  const mine = await myGroupIds(ctx);
  const filter = {};
  if (opts.search?.trim()) filter["%NAME"] = opts.search.trim();
  if (opts.mine) {
    if (mine.size === 0) return envelope([], null, ["\u0412\u044B \u043D\u0435 \u0441\u043E\u0441\u0442\u043E\u0438\u0442\u0435 \u043D\u0438 \u0432 \u043E\u0434\u043D\u043E\u0439 \u0433\u0440\u0443\u043F\u043F\u0435."]);
    filter.ID = [...mine];
  }
  let start = opts.page ? decodeCursor(opts.page, "--page", isStartCursor).s : 0;
  const collected = [];
  let nextStart = null;
  let stoppedByPages = false;
  for (let pages = 0; ; pages++) {
    if (pages >= MAX_PAGES) {
      stoppedByPages = true;
      nextStart = start;
      break;
    }
    const resp = await ctx.client.call("socialnetwork.api.workgroup.list", {
      filter,
      select: ["ID", "NAME", "TYPE", "NUMBER_OF_MEMBERS", "CLOSED"],
      params: { shouldSelectDialogId: "Y" },
      start
    });
    const groups = isObject2(resp.result) ? asArray(resp.result.workgroups).filter(isObject2) : [];
    let i = 0;
    for (; i < groups.length && collected.length < limit; i++) {
      const g = groups[i];
      if (!opts.type || str(pick(g, "type", "TYPE")) === opts.type) collected.push(g);
    }
    const morePages = typeof resp.next === "number" && groups.length > 0;
    if (collected.length >= limit) {
      nextStart = i < groups.length || morePages ? start + i : null;
      break;
    }
    if (!morePages) break;
    start = resp.next;
  }
  const data = collected.map((g) => {
    const id = num(pick(g, "id", "ID")) ?? 0;
    return {
      id,
      name: str(pick(g, "name", "NAME")),
      type: str(pick(g, "type", "TYPE")),
      isMember: mine.has(id),
      members: num(pick(g, "numberOfMembers", "NUMBER_OF_MEMBERS")),
      dialogId: str(g.dialogId) || `sg${id}`
    };
  });
  const notes = [];
  if (data.length === 0) notes.push("\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E.");
  if (stoppedByPages) notes.push(`\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E ${MAX_PAGES * PAGE2} \u0433\u0440\u0443\u043F\u043F; \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A \u2014 --page <next>.`);
  else if (nextStart !== null) notes.push("\u0415\u0441\u0442\u044C \u0435\u0449\u0451: --page <next>.");
  return envelope(data, nextStart !== null ? encodeCursor({ s: nextStart }) : null, notes);
}
async function projectsGet(ctx, idRaw) {
  const id = parseId(idRaw, "id");
  const resp = await ctx.client.call("socialnetwork.api.workgroup.get", { params: { groupId: id } });
  const g = isObject2(resp.result) ? resp.result : {};
  const memberRows = await ctx.client.call("sonet_group.user.get", { ID: id });
  const rows = asArray(memberRows.result).filter(isObject2);
  const shown = rows.slice(0, MAX_MEMBERS);
  const ids = shown.map((r) => num(r.USER_ID)).filter((u) => u !== null);
  const names = /* @__PURE__ */ new Map();
  if (ids.length > 0) {
    const users = await ctx.client.call("user.get", { filter: { ID: ids } });
    for (const u of asArray(users.result).filter(isObject2)) {
      const uid = num(u.ID);
      if (uid !== null) names.set(uid, personName(u));
    }
  }
  const description = truncate(bbToText(str(pick(g, "description", "DESCRIPTION")), /* @__PURE__ */ new Map(), ctx.tz), MAX_TEXT_CHARS);
  const total = Math.max(num(pick(g, "numberOfMembers", "NUMBER_OF_MEMBERS")) ?? 0, rows.length);
  return envelope(
    {
      id,
      name: str(pick(g, "name", "NAME")),
      description: description.text,
      ...description.truncated ? { descriptionTruncated: true } : {},
      type: str(pick(g, "type", "TYPE")),
      ownerId: num(pick(g, "ownerId", "OWNER_ID")),
      dialogId: `sg${id}`,
      members: shown.map((r) => {
        const uid = num(r.USER_ID) ?? 0;
        return { id: uid, name: names.get(uid) ?? `\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A ${uid}`, role: ROLE_NAMES[str(r.ROLE)] ?? str(r.ROLE) };
      }),
      membersTotal: total
    },
    null,
    total > shown.length ? [`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 ${shown.length} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u0438\u0437 ${total}.`] : []
  );
}

// src/commands/tasks.ts
var STATUS = {
  "1": "\u043D\u043E\u0432\u0430\u044F",
  "2": "\u0436\u0434\u0451\u0442 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F",
  "3": "\u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F",
  "4": "\u0436\u0434\u0451\u0442 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F",
  "5": "\u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430",
  "6": "\u043E\u0442\u043B\u043E\u0436\u0435\u043D\u0430",
  "7": "\u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430"
};
var ROLE_FIELDS = {
  responsible: "RESPONSIBLE_ID",
  creator: "CREATED_BY",
  accomplice: "ACCOMPLICE",
  auditor: "AUDITOR"
};
var ROLE_NAMES2 = {
  responsible: "\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439",
  creator: "\u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A",
  accomplice: "\u0441\u043E\u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C",
  auditor: "\u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C"
};
var LIST_SELECT = ["ID", "TITLE", "STATUS", "DEADLINE", "CHANGED_DATE", "RESPONSIBLE_ID", "CREATED_BY", "GROUP_ID"];
var GET_SELECT = [
  "ID",
  "TITLE",
  "DESCRIPTION",
  "STATUS",
  "DEADLINE",
  "CREATED_BY",
  "RESPONSIBLE_ID",
  "ACCOMPLICES",
  "AUDITORS",
  "GROUP_ID",
  "CHAT_ID",
  "CREATED_DATE",
  "CHANGED_DATE",
  "CLOSED_DATE"
];
var PAGE3 = 50;
var IM_DIALOG_RE = /IM_DIALOG=(chat\d+|\d+)/g;
var isStartCursor2 = (v) => isObject2(v) && typeof v.s === "number" && Number.isSafeInteger(v.s) && v.s >= 0;
function invalid3(message) {
  return new AppError({ code: "APP_CLI_INVALID_ARGUMENT", userMessage: message });
}
function person(raw) {
  if (!isObject2(raw)) return null;
  const id = num(raw.id);
  return id === null ? null : { id, name: str(raw.name) };
}
function statusName(raw) {
  return STATUS[str(raw)] ?? str(raw);
}
function summary(t, roles) {
  return {
    id: num(t.id) ?? 0,
    title: str(t.title),
    status: statusName(t.status),
    deadline: str(t.deadline) || null,
    changedDate: str(t.changedDate) || null,
    responsible: person(t.responsible),
    project: person(t.group),
    myRoles: roles.map((r) => ROLE_NAMES2[r] ?? r)
  };
}
async function tasksList(ctx, opts) {
  const role = opts.role ?? "any";
  const status2 = opts.status ?? "active";
  if (role !== "any" && !ROLE_FIELDS[role]) {
    throw invalid3(`\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 --role: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F responsible | creator | accomplice | auditor | any, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${role}\xBB.`);
  }
  if (!["active", "done", "all"].includes(status2)) {
    throw invalid3(`\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 --status: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F active | done | all, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${status2}\xBB.`);
  }
  if (opts.page && role === "any") {
    throw invalid3("\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 --page \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u043E\u0434\u043D\u043E\u0439 \u0440\u043E\u043B\u044C\u044E: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 --role.");
  }
  const limit = parseLimit(opts.limit, 20, PAGE3);
  const base = {};
  if (status2 === "active") base["<REAL_STATUS"] = 5;
  if (status2 === "done") base.REAL_STATUS = 5;
  if (opts.project) base.GROUP_ID = parseId(opts.project, "--project");
  if (opts.search?.trim()) base["%TITLE"] = opts.search.trim();
  const start = opts.page ? decodeCursor(opts.page, "--page", isStartCursor2).s : 0;
  const roles = role === "any" ? Object.keys(ROLE_FIELDS) : [role];
  const merged = /* @__PURE__ */ new Map();
  let next;
  let anyFull = false;
  for (const r of roles) {
    const resp = await ctx.client.call("tasks.task.list", {
      filter: { [ROLE_FIELDS[r]]: ctx.webhook.userId, ...base },
      select: LIST_SELECT,
      order: { CHANGED_DATE: "desc" },
      start
    });
    const tasks = isObject2(resp.result) ? asArray(resp.result.tasks).filter(isObject2) : [];
    anyFull ||= tasks.length >= PAGE3;
    next = resp.next;
    for (const t of tasks) {
      const id = num(t.id);
      if (id === null) continue;
      const entry = merged.get(id) ?? { task: t, roles: [] };
      entry.roles.push(r);
      merged.set(id, entry);
    }
  }
  const sorted = [...merged.values()].sort((a, b) => (Date.parse(str(b.task.changedDate)) || 0) - (Date.parse(str(a.task.changedDate)) || 0)).slice(0, limit).map((e) => summary(e.task, e.roles));
  const notes = [];
  if (sorted.length === 0) notes.push("\u0417\u0430\u0434\u0430\u0447 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E.");
  let cursor = null;
  if (role !== "any" && typeof next === "number") {
    cursor = encodeCursor({ s: next });
    notes.push("\u0415\u0441\u0442\u044C \u0435\u0449\u0451 \u0437\u0430\u0434\u0430\u0447\u0438: --page <next>.");
  } else if (role === "any" && (anyFull || merged.size > limit)) {
    notes.push("\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043F\u043E \u0432\u0441\u0435\u043C \u0432\u0430\u0448\u0438\u043C \u0440\u043E\u043B\u044F\u043C; \u043F\u043E\u043B\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u2014 \u0441 --role \u0438 --page.");
  }
  return envelope(sorted, cursor, notes);
}
async function tasksGet(ctx, idRaw, opts) {
  const id = parseId(idRaw, "id");
  const resp = await ctx.client.call("tasks.task.get", { taskId: id, select: GET_SELECT });
  const t = isObject2(resp.result) && isObject2(resp.result.task) ? resp.result.task : {};
  const rawDescription = str(t.description);
  const text = bbToText(rawDescription, /* @__PURE__ */ new Map(), ctx.tz);
  const description = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  const linkedDialogs = [...new Set([...rawDescription.matchAll(IM_DIALOG_RE)].map((m) => m[1]))];
  const chatId = num(t.chatId);
  const checklistResp = await ctx.client.call("task.checklistitem.getlist", { TASKID: id });
  const checklist = asArray(checklistResp.result).filter(isObject2).map((c) => ({ id: num(c.ID), parentId: num(c.PARENT_ID), title: str(c.TITLE), done: c.IS_COMPLETE === "Y" }));
  const notes = chatId === null ? ["\u0423 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0435\u0442 \u0447\u0430\u0442\u0430 \u2014 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0435\u0442 \u0438\u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0430 \u0432 \u0441\u0442\u0430\u0440\u043E\u043C \u0444\u043E\u0440\u043C\u0430\u0442\u0435."] : [];
  if (linkedDialogs.length > 0) notes.push("\u0412 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0438 \u0435\u0441\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0434\u0440\u0443\u0433\u0438\u0435 \u0447\u0430\u0442\u044B (linkedDialogs) \u2014 \u0438\u0445 \u0442\u043E\u0436\u0435 \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C.");
  return envelope(
    {
      id: num(t.id) ?? id,
      title: str(t.title),
      status: statusName(t.status),
      deadline: str(t.deadline) || null,
      creator: person(t.creator),
      responsible: person(t.responsible),
      accomplices: asArray(t.accomplicesData).map(person).filter((p) => p !== null),
      auditors: asArray(t.auditorsData).map(person).filter((p) => p !== null),
      project: person(t.group),
      description: description.text,
      ...description.truncated ? { descriptionTruncated: true } : {},
      dialogId: chatId === null ? null : `chat${chatId}`,
      linkedDialogs,
      checklist,
      createdDate: str(t.createdDate) || null,
      changedDate: str(t.changedDate) || null,
      closedDate: str(t.closedDate) || null
    },
    null,
    notes
  );
}

// src/cli/register-projects-tasks.ts
function registerProjectsTasks(program2, run) {
  const projects = program2.command("projects").description("\u0413\u0440\u0443\u043F\u043F\u044B, \u043F\u0440\u043E\u0435\u043A\u0442\u044B, \u0441\u043A\u0440\u0430\u043C\u044B, \u043A\u043E\u043B\u043B\u0430\u0431\u044B");
  projects.command("list").description("\u041D\u0430\u0439\u0442\u0438 \u0433\u0440\u0443\u043F\u043F\u0443 \u0438\u043B\u0438 \u043F\u0440\u043E\u0435\u043A\u0442; dialogId \u2014 \u0438\u0445 \u0447\u0430\u0442 \u0434\u043B\u044F chats messages").option("--search <\u0442\u0435\u043A\u0441\u0442>", "\u0447\u0430\u0441\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F").option("--type <\u0442\u0438\u043F>", "group | project | scrum | collab").option("--mine", "\u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435, \u0433\u0434\u0435 \u044F \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 20, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").option("--page <\u043A\u0443\u0440\u0441\u043E\u0440>", "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next \u0438\u0437 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430").action((opts) => run((ctx) => projectsList(ctx, opts)));
  projects.command("get").description("\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0433\u0440\u0443\u043F\u043F\u044B \u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438").argument("<id>", "\u043D\u043E\u043C\u0435\u0440 \u0433\u0440\u0443\u043F\u043F\u044B").action((id) => run((ctx) => projectsGet(ctx, id)));
  const tasks = program2.command("tasks").description("\u0417\u0430\u0434\u0430\u0447\u0438 \u0438 \u0438\u0445 \u0447\u0430\u0442\u044B");
  tasks.command("list").description("\u041C\u043E\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E \u2014 \u0433\u0434\u0435 \u044F \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439, \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0449\u0438\u043A, \u0441\u043E\u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C \u0438\u043B\u0438 \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0442\u0435\u043B\u044C)").option("--role <\u0440\u043E\u043B\u044C>", "responsible | creator | accomplice | auditor | any (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E any)").option("--project <id>", "\u0442\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u0434\u0430\u0447\u0438 \u0433\u0440\u0443\u043F\u043F\u044B").option("--status <\u0441\u0442\u0430\u0442\u0443\u0441>", "active | done | all (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E active)").option("--search <\u0442\u0435\u043A\u0441\u0442>", "\u0447\u0430\u0441\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 20, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").option("--page <\u043A\u0443\u0440\u0441\u043E\u0440>", "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 next (\u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u043E\u0434\u043D\u043E\u0439 \u0440\u043E\u043B\u044C\u044E)").action(
    (opts) => run((ctx) => tasksList(ctx, opts))
  );
  tasks.command("get").description("\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u0434\u0430\u0447\u0438: dialogId \u0435\u0451 \u0447\u0430\u0442\u0430, \u0447\u0430\u0442\u044B \u0438\u0437 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F, \u0447\u0435\u043A-\u043B\u0438\u0441\u0442").argument("<id>", "\u043D\u043E\u043C\u0435\u0440 \u0437\u0430\u0434\u0430\u0447\u0438").option("--full", "\u043D\u0435 \u043E\u0431\u0440\u0435\u0437\u0430\u0442\u044C \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435").action((id, opts) => run((ctx) => tasksGet(ctx, id, opts)));
}

// src/commands/update-check.ts
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
function parseVersion(value) {
  const normalized = value.trim().replace(/^v/i, "");
  return /^\d+(\.\d+)*$/.test(normalized) ? normalized.split(".").map(Number) : null;
}
function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) {
      return x > y;
    }
  }
  return false;
}
function readCache(file) {
  try {
    const parsed = JSON.parse(import_node_fs3.default.readFileSync(file, "utf8"));
    return typeof parsed.checkedAt === "string" && typeof parsed.latestVersion === "string" ? { checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion } : null;
  } catch {
    return null;
  }
}
function writeCache(file, cache) {
  try {
    import_node_fs3.default.mkdirSync(import_node_path3.default.dirname(file), { recursive: true, mode: 448 });
    import_node_fs3.default.writeFileSync(file, JSON.stringify(cache), "utf8");
  } catch {
  }
}
async function fetchLatest(fetchFn) {
  try {
    const response = await fetchFn(UPDATE_CHECK_URL, { signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS) });
    if (!response.ok) {
      return null;
    }
    const pkg = await response.json();
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}
async function checkForUpdate(deps = {}) {
  const now = deps.now ?? /* @__PURE__ */ new Date();
  const file = deps.cachePath ?? UPDATE_CHECK_CACHE_PATH;
  const cache = readCache(file);
  const fresh = cache !== null && now.getTime() - Date.parse(cache.checkedAt) < UPDATE_CHECK_TTL_MS;
  let latest;
  if (fresh && cache) {
    latest = cache.latestVersion;
  } else {
    latest = await fetchLatest(deps.fetchFn ?? fetch);
    if (latest !== null) {
      writeCache(file, { checkedAt: now.toISOString(), latestVersion: latest });
    } else if (cache) {
      latest = cache.latestVersion;
    }
  }
  return { currentVersion: APP_VERSION, latestVersion: latest, updateAvailable: latest !== null && isNewer(latest, APP_VERSION) };
}

// src/commands/status.ts
var SECTION_SCOPES = {
  chats: ["im"],
  notifications: ["im"],
  org: ["im"],
  tasks: ["task"],
  projects: ["sonet_group", "socialnetwork"],
  disk: ["disk"],
  mail: ["mail"],
  calendar: ["calendar"],
  meetings: ["call"],
  feed: ["log"],
  kb: ["note"],
  worktime: ["timeman"],
  users: ["user_basic"]
};
var USER_SCOPES = ["user", "user_basic", "user_brief"];
async function status(ctx, check = () => checkForUpdate()) {
  const scopeResp = await ctx.client.call("scope");
  const granted = (Array.isArray(scopeResp.result) ? scopeResp.result : []).map(String).sort();
  const me = await ctx.client.call("user.current");
  const version = await check();
  const sections = {};
  for (const [section, scopes] of Object.entries(SECTION_SCOPES)) {
    const lacking = scopes.filter(
      (scope) => scope === "user_basic" ? !USER_SCOPES.some((s) => granted.includes(s)) : !granted.includes(scope)
    );
    sections[section] = lacking.length === 0 ? "ok" : `\u043D\u0435\u0442 \u043F\u0440\u0430\u0432\u0430 ${lacking.join(", ")}`;
  }
  const needed = /* @__PURE__ */ new Set([...Object.values(SECTION_SCOPES).flat(), ...USER_SCOPES, "basic"]);
  const extra = granted.filter((s) => !needed.has(s));
  const notes = [];
  const missing = Object.entries(sections).filter(([, v]) => v !== "ok");
  if (missing.length > 0) {
    notes.push(`\u041D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0440\u0430\u0437\u0434\u0435\u043B\u044B: ${missing.map(([k, v]) => `${k} (${v})`).join(", ")}. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u0440\u0430\u0432\u0430 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0432\u0435\u0431\u0445\u0443\u043A\u0430.`);
  }
  if (extra.length > 0) {
    notes.push(`\u041B\u0438\u0448\u043D\u0438\u0435 \u043F\u0440\u0430\u0432\u0430 \u0443 \u0432\u0435\u0431\u0445\u0443\u043A\u0430: ${extra.join(", ")} \u2014 \u0441\u043A\u0438\u043B\u043B\u0443 \u043E\u043D\u0438 \u043D\u0435 \u043D\u0443\u0436\u043D\u044B, \u0438\u0445 \u043C\u043E\u0436\u043D\u043E \u0441\u043D\u044F\u0442\u044C \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0432\u0435\u0431\u0445\u0443\u043A\u0430.`);
  }
  if (version.updateAvailable) {
    notes.push(`\u0412\u044B\u0448\u043B\u0430 \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u0441\u043A\u0438\u043B\u043B\u0430 ${version.latestVersion} (\u0441\u0435\u0439\u0447\u0430\u0441 ${version.currentVersion}). \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C: \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443.`);
  }
  return envelope(
    {
      portal: new URL(ctx.webhook.origin).host,
      webhookUserId: ctx.webhook.userId,
      user: { id: num(me.result.ID) ?? ctx.webhook.userId, name: personName(me.result) },
      sections,
      scopes: { granted, extra },
      version
    },
    null,
    notes
  );
}

// src/commands/users.ts
var MAX_IDS = 50;
function toUser(raw) {
  return {
    id: num(raw.ID) ?? 0,
    name: personName(raw),
    position: str(raw.WORK_POSITION),
    departmentIds: asArray(raw.UF_DEPARTMENT).map((d) => num(d)).filter((d) => d !== null),
    active: raw.ACTIVE === true || raw.ACTIVE === "Y"
  };
}
async function usersFind(ctx, text, limitRaw) {
  const limit = parseLimit(limitRaw, 10, 50);
  const query = text.trim();
  if (query.length < 2) {
    throw new AppError({ code: "APP_CLI_INVALID_ARGUMENT", userMessage: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \u0442\u0435\u043A\u0441\u0442: \u043D\u0443\u0436\u043D\u043E \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432." });
  }
  const resp = await ctx.client.call("user.search", { FILTER: { FIND: query } });
  const all = asArray(resp.result).filter(isObject2).map(toUser);
  const notes = all.length > limit ? [`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 ${limit} \u0438\u0437 ${resp.total ?? all.length}. \u0423\u0442\u043E\u0447\u043D\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441.`] : [];
  return envelope(all.slice(0, limit), null, notes);
}
async function usersGet(ctx, idsRaw) {
  const parts = idsRaw.split(",").map((p) => p.trim()).filter((p) => p !== "");
  const ids = parts.map((p) => num(p));
  if (parts.length === 0 || parts.length > MAX_IDS || ids.some((id) => id === null || !Number.isSafeInteger(id) || id <= 0)) {
    throw new AppError({
      code: "APP_CLI_INVALID_ARGUMENT",
      userMessage: `\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 id: \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0442 1 \u0434\u043E ${MAX_IDS} \u043D\u043E\u043C\u0435\u0440\u043E\u0432 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E \xAB${idsRaw}\xBB.`
    });
  }
  const resp = await ctx.client.call("user.get", { filter: { ID: ids } });
  return envelope(asArray(resp.result).filter(isObject2).map(toUser));
}

// src/cli/register-status-users.ts
function registerStatusUsers(program2, run) {
  program2.command("status").description("\u0412\u044B\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u044B\u043C: \u043F\u043E\u0440\u0442\u0430\u043B, \u0447\u0435\u0439 \u0432\u0435\u0431\u0445\u0443\u043A, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B, \u043B\u0438\u0448\u043D\u0438\u0435 \u043F\u0440\u0430\u0432\u0430, \u043D\u043E\u0432\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u0441\u043A\u0438\u043B\u043B\u0430").action(() => run((ctx) => status(ctx)));
  const users = program2.command("users").description("\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438");
  users.command("find").description("\u041D\u0430\u0439\u0442\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430 \u043F\u043E \u0438\u043C\u0435\u043D\u0438, \u0444\u0430\u043C\u0438\u043B\u0438\u0438 \u0438\u043B\u0438 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0438").argument("<\u0442\u0435\u043A\u0441\u0442>", "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 2 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432").option("--limit <n>", "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E 10, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C 50)").action((text, opts) => run((ctx) => usersFind(ctx, text, opts.limit)));
  users.command("get").description("\u0418\u043C\u0435\u043D\u0430 \u0438 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0438 \u043F\u043E \u043D\u043E\u043C\u0435\u0440\u0430\u043C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432").argument("<id>", "\u043D\u043E\u043C\u0435\u0440\u0430 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u0434\u043E 50").action((ids) => run((ctx) => usersGet(ctx, ids)));
}

// src/cli/program.ts
function buildProgram(run = runCommand) {
  const program2 = new Command();
  program2.name(CLI_NAME).description(
    "\u0411\u0438\u0442\u0440\u0438\u043A\u044124 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0447\u0442\u0435\u043D\u0438\u0435: \u0447\u0430\u0442\u044B, \u0437\u0430\u0434\u0430\u0447\u0438, \u043F\u0440\u043E\u0435\u043A\u0442\u044B, \u0434\u0438\u0441\u043A, \u043F\u043E\u0447\u0442\u0430, \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C, \u0432\u0441\u0442\u0440\u0435\u0447\u0438, \u043B\u0435\u043D\u0442\u0430, \u0431\u0430\u0437\u0430 \u0437\u043D\u0430\u043D\u0438\u0439. \u0412\u044B\u0432\u043E\u0434 \u2014 JSON."
  ).version(APP_VERSION).helpCommand(false).exitOverride().configureOutput({ writeErr: () => void 0, outputError: () => void 0 });
  registerStatusUsers(program2, run);
  registerChats(program2, run);
  registerProjectsTasks(program2, run);
  return program2;
}
var HELP_CODES = /* @__PURE__ */ new Set(["commander.helpDisplayed", "commander.help", "commander.version"]);
function translate(err) {
  const token = /'([^']+)'/.exec(err.message)?.[1] ?? "";
  const messages = {
    "commander.unknownCommand": `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \xAB${token}\xBB. \u0421\u043F\u0438\u0441\u043E\u043A \u043A\u043E\u043C\u0430\u043D\u0434: b24 --help.`,
    "commander.unknownOption": `\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \xAB${token}\xBB. \u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435: b24 <\u043A\u043E\u043C\u0430\u043D\u0434\u0430> --help.`,
    "commander.missingArgument": `\u041D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u0430 \xAB${token}\xBB. \u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435: b24 <\u043A\u043E\u043C\u0430\u043D\u0434\u0430> --help.`,
    "commander.optionMissingArgument": `\u0423 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430 \xAB${token}\xBB \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435.`,
    "commander.missingMandatoryOptionValue": `\u041D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440 \xAB${token}\xBB.`,
    "commander.excessArguments": "\u041B\u0438\u0448\u043D\u0438\u0435 \u0430\u0440\u0433\u0443\u043C\u0435\u043D\u0442\u044B \u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u044B. \u0421\u043F\u0440\u0430\u0432\u043A\u0430 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435: b24 <\u043A\u043E\u043C\u0430\u043D\u0434\u0430> --help."
  };
  return new AppError({
    code: "APP_CLI_INVALID_ARGUMENT",
    userMessage: messages[err.code] ?? "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u0432\u044B\u0437\u0432\u0430\u043D\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u043E: \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B. \u0421\u043F\u0440\u0430\u0432\u043A\u0430: b24 --help.",
    details: { commanderCode: err.code }
  });
}
async function parseArgs(argv, run = runCommand) {
  try {
    await buildProgram(run).parseAsync(argv, { from: "user" });
  } catch (err) {
    if (err instanceof CommanderError) {
      if (HELP_CODES.has(err.code)) {
        return;
      }
      throw translate(err);
    }
    throw err;
  }
}

// src/cli.ts
process.on("uncaughtException", (err) => {
  reportError(err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  reportError(err);
  process.exit(1);
});
async function main() {
  bootstrapEnv();
  await parseArgs(process.argv.slice(2));
}
main().catch((err) => reportError(err));
