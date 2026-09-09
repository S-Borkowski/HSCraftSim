// Recover only known native jump tables in our isolated research project.
// @category HeroSiege
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.pcode.JumpTable;
import ghidra.program.model.symbol.*;
import java.util.ArrayList;
import java.io.PrintWriter;

public class RecoverCompletionSwitches extends GhidraScript {
 public void run() throws Exception {
  String[] args=getScriptArgs();
  DecompInterface decompiler=new DecompInterface();
  DecompileOptions options=new DecompileOptions();
  options.setMaxPayloadMBytes(100);options.setMaxJumpTableEntries(4096);options.setMaxInstructions(1000000);
  decompiler.setOptions(options);decompiler.openProgram(currentProgram);
  try {
   for(int i=0;i<args.length;i+=5){
    Address entry=toAddr(args[i]), jump=toAddr(args[i+1]),table=toAddr(args[i+2]);
    Function function=getFunctionAt(entry);
    ArrayList<Address> targets=new ArrayList<>();
    for(int n=0;n<Integer.parseInt(args[i+3]);n++) {
     Address target=toAddr(0x140000000L+Integer.toUnsignedLong(getInt(table.add(n*4))));
     disassemble(target);targets.add(target);
     currentProgram.getReferenceManager().addMemoryReference(jump,target,RefType.COMPUTED_JUMP,SourceType.USER_DEFINED,0);
    }
    new JumpTable(jump,targets,true,0).writeOverride(function);
    decompiler.flushCache();
    DecompileResults result=decompiler.decompileFunction(function,600,monitor);
    if(!result.decompileCompleted())throw new IllegalStateException(result.getErrorMessage());
    try(PrintWriter writer=new PrintWriter(args[i+4],"UTF-8")){writer.println(result.getDecompiledFunction().getC());}
    println("Recovered "+function.getName()+" -> "+args[i+4]);
   }
  } finally {decompiler.dispose();}
 }
}
