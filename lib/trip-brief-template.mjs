import {PDFDocument,rgb,PDFName} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Reusable, offline AcroForm; shares the live brief's wordmark, fonts and colors.
// It has no submit action, network request or email integration.
export async function createTripBriefTemplate({loadAsset}={}){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const [regular,bold,serif,logo]=await Promise.all([
  loadAsset('/assets/pdf/dm-regular.ttf').then(bytes=>pdf.embedFont(bytes)),
  loadAsset('/assets/pdf/dm-semibold.ttf').then(bytes=>pdf.embedFont(bytes,{subset:true})),
  loadAsset('/assets/pdf/cormorant-medium.ttf').then(bytes=>pdf.embedFont(bytes,{subset:true})),
  loadAsset('/assets/pdf/june-links-logo.png').then(bytes=>pdf.embedPng(bytes))
 ]);
 const form=pdf.getForm(),W=595.28,H=841.89,M=42,C=W-2*M,gap=24,col=(C-gap)/2;
 const color=h=>rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4),16)/255);
 const green=color('1f4d3a'),gold=color('b6985e'),ivory=color('f8f3e9'),muted=color('677168'),line=color('d9d1be'),white=rgb(1,1,1);
 let page;
 function text(s,x,top,size=10,font=regular,tone=green){page.drawText(s,{x,y:H-top-size,size,font,color:tone});}
 function rule(top){page.drawLine({start:{x:M,y:H-top},end:{x:W-M,y:H-top},color:line,thickness:.65});}
 function field(name,label,x,top,width,{height=31,max=160,multiline=false,options,required=false}={}){
  text(label+(required?' *':''),x,top-14,8.5,bold,muted);
  let f=form.getFieldMaybe(name);
  if(!f){f=options?form.createDropdown(name):form.createTextField(name);if(options){f.addOptions(options);f.disableEditing();}else{f.setText('');f.setMaxLength(max);if(multiline)f.enableMultiline();}if(required)f.enableRequired();}
  f.addToPage(page,{x,y:H-top-height,width,height,borderWidth:.65,borderColor:line,backgroundColor:white,textColor:green,font:regular});
  f.setFontSize(multiline?10:11);f.acroField.dict.set(PDFName.of('TU'),pdf.context.obj(label+(required?' (required)':'')));
  return f;
 }
 function pair(top,left,right){field(left[0],left[1],M,top,col,left[2]||{});field(right[0],right[1],M+col+gap,top,col,right[2]||{});}
 function start(number,title,subtitle,section){
  page=pdf.addPage([W,H]);page.node.set(PDFName.of('Tabs'),PDFName.of('S'));
  page.drawRectangle({x:0,y:0,width:W,height:H,color:ivory});page.drawRectangle({x:0,y:H-4,width:W,height:4,color:gold});
  page.drawImage(logo,{x:M,y:H-76,width:216,height:36});
  field('reference','Inquiry reference',W-M-117,42,117,{height:28,max:30});rule(96);
  text('YOUR JOURNEY BRIEF',M,115,8.5,bold,gold);text(title,M,134,32,serif);text(subtitle,M,181,10,regular,muted);
  page.drawRectangle({x:M,y:H-246,width:C,height:36,color:green});text(section,M+14,222,10,bold,ivory);
  rule(790);text('June Links | Golf journeys, worldwide',M,801,8.5,regular,muted);text('junelinks.com',W-M-109,801,8.5,bold);
  text('Inquiry only. No booking or payment commitment.',M,816,7.5,regular,muted);text(number+' / 2',W-M-24,816,7.5,regular,muted);
 }
 start(1,'A journey of your own.','Tell us where you would like to play, and the time you have.','01 / YOUR JOURNEY');
 field('destinationText','Destination / location',M,280,C,{max:240});
 pair(337,['requestedCountry','Country',{max:120}],['requestedRegion','State / region',{max:240}]);
 field('requestedVenue','Preferred course or venue',M,394,C,{max:200});
 pair(451,['departureCity','Departing from',{max:120}],['travelWindow','Travel window, if dates are undecided',{max:120}]);
 pair(508,['arrival','Preferred arrival / YYYY-MM-DD',{max:10}],['flexibility','Date flexibility',{options:['To discuss','Fixed dates','A week either way','Within the same month','Open to recommendations']}]);
 const statGap=16,statWidth=(C-statGap*3)/4;
 [['nights','Nights away'],['travelers','Total travelers'],['golfers','Golfers'],['golfDays','Days with golf']].forEach(([name,label],i)=>field(name,label,M+i*(statWidth+statGap),565,statWidth,{max:3}));
 pair(622,['tier','Your level of care',{required:true,options:['The Round - Golf only','The Journey - Golf and transfers','The Signature - Golf, stays and more']}],['pace','Your preferred pace',{options:['A balance of golf and exploring','A few rounds, plenty of downtime','Golf most days','Golf every day / possible 36 holes','Help me decide']}]);
 field('budgetLevel','Your preferred spend',M,679,C,{options:['Open to guidance','$ - Considered','$$ - Elevated','$$$ - Luxury','$$$$ - Exceptional']});
 text('Fields marked * are required. Continue with your preferences and contact details on page 2.',M,738,8.5,regular,muted);

 start(2,'Every detail, considered.','The days around the golf, and the best way to reach you.','02 / YOUR PREFERENCES');
 pair(280,['transport','Ground transport',{options:['Recommend an option','Arranged by the traveler','Airport and course transfers','Private driver request','Rental vehicle advice']}],['accommodation','Accommodation',{options:['Open to suggestions','Already arranged / not needed','Boutique hotel','Full-service resort','Luxury hotel or villa']}]);
 field('interests','Time beyond golf / interests',M,337,C,{max:300});
 field('courses','Must-play courses and golf preferences',M,394,C,{height:54,max:1000,multiline:true});
 field('notes','Other requests / room setup, occasion or planning details',M,475,C,{height:70,max:1500,multiline:true});
 text('Let the conversation begin.',M,565,20,serif);
 pair(621,['name','Your name',{required:true,max:120}],['email','Email address',{required:true,max:254}]);
 pair(678,['phone','Phone / optional',{max:40}],['contactPreference','Preferred reply',{options:['Email','Phone call']}]);
 pair(735,['timezone','Your time zone / city',{max:120}],['bestTime','Best time to reach you / local to your zone',{max:120}]);
 form.updateFieldAppearances(regular);
 pdf.setTitle('June Links - reusable trip brief template');pdf.setAuthor('June Links');pdf.setSubject('Editable trip inquiry template');pdf.setCreator('June Links');
 return pdf.save({updateFieldAppearances:false});
}
