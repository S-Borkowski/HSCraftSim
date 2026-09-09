// Headless: create functions at given RVAs and decompile them to <outdir>/<name>.c
// args: <outdir> <rvaHex=name> ...
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class HsDecomp extends GhidraScript {
    public void run() throws Exception {
        String[] args = getScriptArgs();
        File outDir = new File(args[0]); outDir.mkdirs();
        DecompileOptions options = new DecompileOptions();
        options.setMaxPayloadMBytes(512);
        options.setMaxInstructions(4000000);
        options.setDefaultTimeout(3600);
        DecompInterface dec = new DecompInterface();
        dec.setOptions(options);
        dec.toggleCCode(true);
        dec.openProgram(currentProgram);
        Address base = currentProgram.getImageBase();
        PrintWriter log = new PrintWriter(new FileWriter(new File(outDir, "_log.txt"), true));
        for (int i = 1; i < args.length; i++) {
            String spec = args[i];
            long rva; String name;
            int eq = spec.indexOf('=');
            if (eq > 0) { rva = Long.parseUnsignedLong(spec.substring(0, eq).replace("0x",""), 16); name = spec.substring(eq + 1); }
            else { rva = Long.parseUnsignedLong(spec.replace("0x",""), 16); name = args[++i]; }
            try {
                Address a = base.add(rva);
                Function f = getFunctionAt(a);
                if (f == null) { disassemble(a); f = createFunction(a, name); }
                if (f == null) { log.println(name + ": NO FUNC @ " + a); log.flush(); continue; }
                DecompileResults r = dec.decompileFunction(f, 3600, monitor);
                String c = (r != null && r.getDecompiledFunction() != null) ? r.getDecompiledFunction().getC() : ("(decompile failed) " + (r == null ? "null" : r.getErrorMessage()));
                PrintWriter pw = new PrintWriter(new FileWriter(new File(outDir, name + ".c"))); pw.print(c); pw.close();
                log.println(name + ": @ " + a + " -> " + c.length() + " chars"); log.flush();
            } catch (Exception e) { log.println(name + ": EXC " + e); log.flush(); }
        }
        log.close();
        dec.dispose();
    }
}
