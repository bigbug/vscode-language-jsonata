const xml2js = require('xml2js');
export default function loadXML(fileString: string) : Promise<unknown> {
    let parser = new xml2js.Parser(/* options */);
    return parser.parseStringPromise(fileString);
}