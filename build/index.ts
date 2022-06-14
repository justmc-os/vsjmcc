import fs from "fs";
import path from "path";
import yaml from "js-yaml";

enum Language {
  JustCode = "JustCode",
}

enum Suffix {
  TmLanguage = ".tmLanguage.json",
  YamlTmLanguage = "-tmLanguage.yaml",
}

function file(language: Language, suffix: Suffix) {
  return path.join(__dirname, "..", `${language}${suffix}`);
}

function writeFile(grammar: TmGrammar | TmTheme, fileName: string) {
  fs.writeFileSync(fileName, JSON.stringify(grammar));
}

function readYaml(fileName: string) {
  const text = fs.readFileSync(fileName, "utf8");
  return yaml.load(text);
}

function transformGrammarRule(
  rule: any,
  propertyNames: string[],
  transformProperty: (ruleProperty: string) => string
) {
  for (const propertyName of propertyNames) {
    const value = rule[propertyName];
    if (typeof value === "string") {
      rule[propertyName] = transformProperty(value);
    }
  }

  for (var propertyName in rule) {
    const value = rule[propertyName];
    if (typeof value === "object") {
      transformGrammarRule(value, propertyNames, transformProperty);
    }
  }
}

function transformGrammarRepository(
  grammar: TmGrammar,
  propertyNames: string[],
  transformProperty: (ruleProperty: string) => string
) {
  const repository = grammar.repository;
  for (let key in repository) {
    transformGrammarRule(repository[key], propertyNames, transformProperty);
  }
}

function getJcGrammar(
  getVariables: (tsGrammarVariables: MapLike<string>) => MapLike<string>
) {
  const jcGrammarBeforeTransformation = readYaml(
    file(Language.JustCode, Suffix.YamlTmLanguage)
  ) as TmGrammar;
  return updateGrammarVariables(
    jcGrammarBeforeTransformation,
    getVariables(jcGrammarBeforeTransformation.variables as MapLike<string>)
  );
}

function replacePatternVariables(
  pattern: string,
  variableReplacers: VariableReplacer[]
) {
  let result = pattern;
  for (const [variableName, value] of variableReplacers) {
    result = result.replace(variableName, value);
  }
  return result;
}

type VariableReplacer = [RegExp, string];
function updateGrammarVariables(
  grammar: TmGrammar,
  variables: MapLike<string>
) {
  delete grammar.variables;
  const variableReplacers: VariableReplacer[] = [];
  for (const variableName in variables) {
    // Replace the pattern with earlier variables
    const pattern = replacePatternVariables(
      variables[variableName],
      variableReplacers
    );
    variableReplacers.push([new RegExp(`{{${variableName}}}`, "gim"), pattern]);
  }
  transformGrammarRepository(grammar, ["begin", "end", "match"], (pattern) =>
    replacePatternVariables(pattern, variableReplacers)
  );
  return grammar;
}

function buildGrammar() {
  const jcGrammar = getJcGrammar((grammarVariables) => grammarVariables);

  writeFile(jcGrammar, file(Language.JustCode, Suffix.TmLanguage));
}

buildGrammar();
